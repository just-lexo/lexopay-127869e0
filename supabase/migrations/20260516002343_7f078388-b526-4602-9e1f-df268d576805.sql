
-- 1. Unique key for app_settings (needed for rate overrides upsert)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_settings_key_unique') THEN
    ALTER TABLE public.app_settings ADD CONSTRAINT app_settings_key_unique UNIQUE (key);
  END IF;
END $$;

-- 2. KYC tier upgrade fields
ALTER TABLE public.kyc_submissions
  ADD COLUMN IF NOT EXISTS tier_target integer DEFAULT 2,
  ADD COLUMN IF NOT EXISTS bvn text,
  ADD COLUMN IF NOT EXISTS nin text,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_response jsonb;

-- 3. Tiered withdrawal fee engine + stamp duty
CREATE OR REPLACE FUNCTION public.calculate_withdraw_fee(_amount numeric, _tier integer)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  _base numeric;
  _stamp numeric := 0;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN
    RETURN jsonb_build_object('base_fee', 0, 'stamp_duty', 0, 'total_fee', 0);
  END IF;

  IF _amount < 5000 THEN _base := 20;
  ELSIF _amount < 50000 THEN _base := 30;
  ELSIF _amount < 200000 THEN _base := 50;
  ELSE _base := 100;
  END IF;

  -- KYC discounts
  IF COALESCE(_tier, 0) >= 3 THEN _base := _base * 0.5;
  ELSIF COALESCE(_tier, 0) >= 2 THEN _base := _base * 0.75;
  END IF;

  -- CBN stamp duty: ₦50 on transfers ≥ ₦10,000
  IF _amount >= 10000 THEN _stamp := 50; END IF;

  RETURN jsonb_build_object(
    'base_fee', round(_base, 2),
    'stamp_duty', _stamp,
    'total_fee', round(_base + _stamp, 2)
  );
END; $$;

-- 4. Server-authoritative withdraw_ngn (fee recomputed; client _fee ignored)
CREATE OR REPLACE FUNCTION public.withdraw_ngn(
  _amount numeric, _fee numeric, _bank_code text, _bank_name text,
  _account_number text, _account_name text, _pin text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _profile RECORD;
  _ngn_wallet_id uuid;
  _current_ngn numeric;
  _fee_breakdown jsonb;
  _server_fee numeric;
  _total_deduction numeric;
  _reference text;
  _withdrawal_id uuid;
  _today_usage numeric;
  _limit numeric;
BEGIN
  IF _amount <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive'); END IF;

  SELECT kyc_tier, is_frozen, transaction_pin_hash INTO _profile
  FROM public.profiles WHERE user_id = _user_id;

  IF _profile IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Profile not found'); END IF;
  IF _profile.is_frozen THEN RETURN jsonb_build_object('success', false, 'error', 'Account frozen. Contact support.'); END IF;
  IF _profile.transaction_pin_hash IS NOT NULL AND NOT public._verify_pin_internal(_user_id, _pin) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid PIN');
  END IF;

  -- Recompute fee server-side; ignore client _fee
  _fee_breakdown := public.calculate_withdraw_fee(_amount, _profile.kyc_tier);
  _server_fee := (_fee_breakdown->>'total_fee')::numeric;
  _total_deduction := _amount + _server_fee;

  _limit := public.get_tier_daily_limit(_profile.kyc_tier);
  SELECT COALESCE(ngn_outflow, 0) INTO _today_usage
  FROM public.daily_usage
  WHERE user_id = _user_id AND usage_date = (now() AT TIME ZONE 'UTC')::date;
  IF COALESCE(_today_usage, 0) + _total_deduction > _limit THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Daily limit ₦' || _limit || ' exceeded. Upgrade KYC for higher limits.',
      'limit', _limit, 'used', COALESCE(_today_usage, 0));
  END IF;

  SELECT id INTO _ngn_wallet_id FROM public.wallets WHERE user_id = _user_id AND type = 'NGN';
  IF _ngn_wallet_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Wallet not found'); END IF;

  SELECT balance INTO _current_ngn FROM public.ngn_balances WHERE wallet_id = _ngn_wallet_id FOR UPDATE;
  IF _current_ngn IS NULL OR _current_ngn < _total_deduction THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance', 'fee', _server_fee);
  END IF;

  _reference := 'LXP-WD-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 6);

  UPDATE public.ngn_balances SET balance = balance - _total_deduction, updated_at = now() WHERE wallet_id = _ngn_wallet_id;

  INSERT INTO public.withdrawals (user_id, amount, bank_code, bank_name, account_number, account_name, reference, status)
  VALUES (_user_id, _amount, _bank_code, _bank_name, _account_number, _account_name, _reference, 'PROCESSING')
  RETURNING id INTO _withdrawal_id;

  INSERT INTO public.transactions (user_id, kind, title, subtitle, amount_display, status, metadata)
  VALUES (
    _user_id, 'WITHDRAW', 'Bank Transfer', _bank_name || ' • ' || _account_name,
    '-₦' || _total_deduction || ' (sent ₦' || _amount || ', fee ₦' || _server_fee || ')',
    'PROCESSING',
    jsonb_build_object('withdrawal_id', _withdrawal_id, 'bank_code', _bank_code, 'bank_name', _bank_name,
      'account_number', _account_number, 'account_name', _account_name,
      'amount', _amount, 'fee', _server_fee, 'fee_breakdown', _fee_breakdown, 'reference', _reference)
  );

  PERFORM public._bump_daily_usage(_user_id, _total_deduction);

  INSERT INTO public.treasury_ledger (entry_type, asset, amount, user_id, reference_id, reference_kind, metadata)
  VALUES
    ('WITHDRAW_OUT', 'NGN', _amount, _user_id, _withdrawal_id, 'withdrawal', jsonb_build_object('reference', _reference)),
    ('FEE_REVENUE', 'NGN', _server_fee, _user_id, _withdrawal_id, 'withdrawal',
      jsonb_build_object('source', 'withdraw_fee', 'breakdown', _fee_breakdown));

  RETURN jsonb_build_object('success', true, 'withdrawal_id', _withdrawal_id, 'reference', _reference, 'fee', _server_fee, 'fee_breakdown', _fee_breakdown);
END; $$;

-- 5. Admin: resolve a pending conversion (success credits NGN, failure refunds crypto)
CREATE OR REPLACE FUNCTION public.admin_resolve_conversion(_conversion_id uuid, _success boolean, _note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin uuid := auth.uid();
  _conv RECORD;
  _crypto_wallet uuid;
  _ngn_wallet uuid;
  _existing_balance numeric;
BEGIN
  IF NOT public.is_platform_admin(_admin) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT * INTO _conv FROM public.conversions WHERE id = _conversion_id FOR UPDATE;
  IF _conv IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Conversion not found'); END IF;
  IF _conv.status <> 'PROCESSING' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already resolved');
  END IF;

  IF _success THEN
    SELECT id INTO _ngn_wallet FROM public.wallets WHERE user_id = _conv.user_id AND type = 'NGN';
    IF _ngn_wallet IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'NGN wallet missing'); END IF;
    UPDATE public.ngn_balances SET balance = balance + _conv.ngn_amount, updated_at = now() WHERE wallet_id = _ngn_wallet;
    UPDATE public.conversions SET status = 'SUCCESS', updated_at = now() WHERE id = _conversion_id;
    INSERT INTO public.transactions (user_id, kind, title, subtitle, amount_display, status, metadata)
    VALUES (_conv.user_id, 'CONVERT', 'Crypto Conversion', _conv.from_token || ' to NGN',
      '-' || _conv.from_amount || ' ' || _conv.from_token || ' → +₦' || _conv.ngn_amount,
      'SUCCESS',
      jsonb_build_object('conversion_id', _conversion_id, 'from_amount', _conv.from_amount,
        'from_token', _conv.from_token, 'from_network', _conv.from_network,
        'rate', _conv.rate, 'fee', _conv.fee, 'ngn_amount', _conv.ngn_amount));

    INSERT INTO public.notifications (user_id, type, title, message, related_id, related_kind)
    VALUES (_conv.user_id, 'conversion_completed', 'Conversion Complete',
      'Your ' || _conv.from_token || ' was converted to ₦' || _conv.ngn_amount || '.',
      _conversion_id, 'conversion');
  ELSE
    SELECT id INTO _crypto_wallet FROM public.wallets WHERE user_id = _conv.user_id AND type = 'CRYPTO';
    SELECT balance INTO _existing_balance FROM public.crypto_balances
    WHERE wallet_id = _crypto_wallet AND token = _conv.from_token AND network = _conv.from_network FOR UPDATE;
    IF _existing_balance IS NULL THEN
      INSERT INTO public.crypto_balances (wallet_id, token, network, balance)
      VALUES (_crypto_wallet, _conv.from_token, _conv.from_network, _conv.from_amount);
    ELSE
      UPDATE public.crypto_balances SET balance = balance + _conv.from_amount, updated_at = now()
      WHERE wallet_id = _crypto_wallet AND token = _conv.from_token AND network = _conv.from_network;
    END IF;
    UPDATE public.conversions SET status = 'FAILED', updated_at = now() WHERE id = _conversion_id;

    INSERT INTO public.notifications (user_id, type, title, message, related_id, related_kind)
    VALUES (_conv.user_id, 'conversion_failed', 'Conversion Failed',
      COALESCE(_note, 'Your conversion could not be completed. Crypto refunded.'),
      _conversion_id, 'conversion');
  END IF;

  INSERT INTO public.admin_audit_log (admin_id, action, target_user_id, target_id, target_kind, details)
  VALUES (_admin, CASE WHEN _success THEN 'APPROVE_CONVERSION' ELSE 'FAIL_CONVERSION' END,
          _conv.user_id, _conversion_id, 'conversion', jsonb_build_object('note', _note));

  RETURN jsonb_build_object('success', true);
END; $$;

-- 6. Admin: manual treasury adjustment
CREATE OR REPLACE FUNCTION public.admin_treasury_adjust(_entry_type text, _asset text, _amount numeric, _note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin uuid := auth.uid();
  _id uuid;
BEGIN
  IF NOT public.is_platform_admin(_admin) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  IF _entry_type NOT IN ('MANUAL_ADJUSTMENT', 'CORRECTION', 'EXPENSE', 'REVENUE') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid entry type');
  END IF;
  IF _asset IS NULL OR length(trim(_asset)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Asset required');
  END IF;

  INSERT INTO public.treasury_ledger (entry_type, asset, amount, reference_kind, metadata)
  VALUES (_entry_type, upper(_asset), _amount, 'manual',
          jsonb_build_object('admin', _admin, 'note', _note))
  RETURNING id INTO _id;

  INSERT INTO public.admin_audit_log (admin_id, action, target_id, target_kind, details)
  VALUES (_admin, 'TREASURY_ADJUST', _id, 'treasury',
          jsonb_build_object('type', _entry_type, 'asset', _asset, 'amount', _amount, 'note', _note));

  RETURN jsonb_build_object('success', true, 'id', _id);
END; $$;

-- 7. Daily P&L
CREATE OR REPLACE FUNCTION public.admin_treasury_pnl(_days integer DEFAULT 30)
RETURNS TABLE(day date, fee_revenue numeric, spread_revenue numeric, manual numeric, total numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  RETURN QUERY
    SELECT
      (created_at AT TIME ZONE 'UTC')::date AS day,
      COALESCE(SUM(amount) FILTER (WHERE entry_type = 'FEE_REVENUE'), 0) AS fee_revenue,
      COALESCE(SUM(amount) FILTER (WHERE entry_type = 'CONVERSION_SPREAD'), 0) AS spread_revenue,
      COALESCE(SUM(amount) FILTER (WHERE entry_type IN ('MANUAL_ADJUSTMENT','REVENUE')), 0)
        - COALESCE(SUM(amount) FILTER (WHERE entry_type IN ('EXPENSE','CORRECTION')), 0) AS manual,
      COALESCE(SUM(CASE
        WHEN entry_type IN ('FEE_REVENUE','CONVERSION_SPREAD','MANUAL_ADJUSTMENT','REVENUE') THEN amount
        WHEN entry_type IN ('EXPENSE','CORRECTION') THEN -amount
        ELSE 0 END), 0) AS total
    FROM public.treasury_ledger
    WHERE created_at >= now() - (_days || ' days')::interval
    GROUP BY day
    ORDER BY day DESC;
END; $$;

-- 8. Per-asset treasury totals
CREATE OR REPLACE FUNCTION public.admin_treasury_per_asset()
RETURNS TABLE(asset text, fee_revenue numeric, spread_revenue numeric, deposits_in numeric, withdrawals_out numeric, manual_net numeric, net numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  RETURN QUERY
    SELECT
      asset,
      COALESCE(SUM(amount) FILTER (WHERE entry_type = 'FEE_REVENUE'), 0),
      COALESCE(SUM(amount) FILTER (WHERE entry_type = 'CONVERSION_SPREAD'), 0),
      COALESCE(SUM(amount) FILTER (WHERE entry_type = 'DEPOSIT_IN'), 0),
      COALESCE(SUM(amount) FILTER (WHERE entry_type = 'WITHDRAW_OUT'), 0),
      COALESCE(SUM(amount) FILTER (WHERE entry_type IN ('MANUAL_ADJUSTMENT','REVENUE')), 0)
        - COALESCE(SUM(amount) FILTER (WHERE entry_type IN ('EXPENSE','CORRECTION')), 0),
      COALESCE(SUM(CASE
        WHEN entry_type IN ('FEE_REVENUE','CONVERSION_SPREAD','DEPOSIT_IN','MANUAL_ADJUSTMENT','REVENUE') THEN amount
        WHEN entry_type IN ('WITHDRAW_OUT','EXPENSE','CORRECTION') THEN -amount
        ELSE 0 END), 0)
    FROM public.treasury_ledger
    GROUP BY asset
    ORDER BY asset;
END; $$;

-- 9. Admin: set per-asset rate override (read by get-live-prices edge function)
CREATE OR REPLACE FUNCTION public.admin_set_rate_override(_token text, _spread_pct numeric, _manual_price_usd numeric, _enabled boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin uuid := auth.uid();
  _current jsonb;
BEGIN
  IF NOT public.is_platform_admin(_admin) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  IF _token IS NULL OR length(trim(_token)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Token required');
  END IF;

  SELECT value INTO _current FROM public.app_settings WHERE key = 'rate_overrides';
  IF _current IS NULL OR jsonb_typeof(_current) <> 'object' THEN _current := '{}'::jsonb; END IF;

  _current := jsonb_set(
    _current,
    ARRAY[upper(trim(_token))],
    jsonb_build_object(
      'spread_pct', _spread_pct,
      'manual_price_usd', _manual_price_usd,
      'enabled', COALESCE(_enabled, false),
      'updated_at', to_jsonb(now())
    ),
    true
  );

  INSERT INTO public.app_settings (key, value, updated_at)
  VALUES ('rate_overrides', _current, now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

  INSERT INTO public.admin_audit_log (admin_id, action, target_kind, details)
  VALUES (_admin, 'RATE_OVERRIDE', 'rate',
          jsonb_build_object('token', _token, 'spread_pct', _spread_pct,
                             'manual_price_usd', _manual_price_usd, 'enabled', _enabled));

  RETURN jsonb_build_object('success', true);
END; $$;

-- 10. KYC: instant tier upgrade after a successful provider verification (Dojah/Smile)
CREATE OR REPLACE FUNCTION public.admin_apply_kyc_provider_result(_user_id uuid, _provider text, _tier integer, _provider_response jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _admin uuid := auth.uid();
BEGIN
  -- Allow either an admin OR the user themselves (for self-verification flows)
  IF _admin IS NULL OR (_admin <> _user_id AND NOT public.is_platform_admin(_admin)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  UPDATE public.profiles
  SET kyc_tier = GREATEST(COALESCE(kyc_tier, 0), _tier),
      updated_at = now()
  WHERE user_id = _user_id;

  INSERT INTO public.admin_audit_log (admin_id, action, target_user_id, target_kind, details)
  VALUES (COALESCE(_admin, _user_id), 'KYC_TIER_UPGRADE', _user_id, 'profile',
          jsonb_build_object('provider', _provider, 'tier', _tier, 'response', _provider_response));

  RETURN jsonb_build_object('success', true);
END; $$;
