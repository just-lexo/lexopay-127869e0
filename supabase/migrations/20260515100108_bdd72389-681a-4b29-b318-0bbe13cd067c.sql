
-- Enable pgcrypto for PIN hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Add PIN + freeze columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS transaction_pin_hash text,
  ADD COLUMN IF NOT EXISTS pin_set_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_frozen boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS frozen_reason text,
  ADD COLUMN IF NOT EXISTS frozen_at timestamptz;

-- 2. Daily usage tracking (NGN outflow per UTC day)
CREATE TABLE IF NOT EXISTS public.daily_usage (
  user_id uuid NOT NULL,
  usage_date date NOT NULL,
  ngn_outflow numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, usage_date)
);
ALTER TABLE public.daily_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own usage" ON public.daily_usage FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all usage" ON public.daily_usage FOR SELECT USING (public.is_platform_admin(auth.uid()));

-- 3. Treasury ledger
CREATE TABLE IF NOT EXISTS public.treasury_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_type text NOT NULL,
  asset text NOT NULL,
  amount numeric NOT NULL,
  user_id uuid,
  reference_id uuid,
  reference_kind text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.treasury_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read treasury" ON public.treasury_ledger FOR SELECT USING (public.is_platform_admin(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_treasury_created ON public.treasury_ledger (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_treasury_type ON public.treasury_ledger (entry_type);

-- 4. Admin audit log
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  action text NOT NULL,
  target_user_id uuid,
  target_kind text,
  target_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read audit" ON public.admin_audit_log FOR SELECT USING (public.is_platform_admin(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.admin_audit_log (created_at DESC);

-- 5. Tier limit lookup
CREATE OR REPLACE FUNCTION public.get_tier_daily_limit(_tier int)
RETURNS numeric
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE COALESCE(_tier, 0)
    WHEN 0 THEN 50000::numeric
    WHEN 1 THEN 200000::numeric
    WHEN 2 THEN 1000000::numeric
    ELSE 5000000::numeric
  END;
$$;

-- 6. PIN management
CREATE OR REPLACE FUNCTION public.set_transaction_pin(_pin text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Not authenticated'); END IF;
  IF _pin IS NULL OR _pin !~ '^[0-9]{4,6}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'PIN must be 4-6 digits');
  END IF;
  UPDATE public.profiles
  SET transaction_pin_hash = crypt(_pin, gen_salt('bf', 10)),
      pin_set_at = now(),
      updated_at = now()
  WHERE user_id = _uid;
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.change_transaction_pin(_old_pin text, _new_pin text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _hash text;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Not authenticated'); END IF;
  SELECT transaction_pin_hash INTO _hash FROM public.profiles WHERE user_id = _uid;
  IF _hash IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'No PIN set'); END IF;
  IF _hash <> crypt(_old_pin, _hash) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Current PIN incorrect');
  END IF;
  IF _new_pin !~ '^[0-9]{4,6}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'New PIN must be 4-6 digits');
  END IF;
  UPDATE public.profiles
  SET transaction_pin_hash = crypt(_new_pin, gen_salt('bf', 10)),
      pin_set_at = now(),
      updated_at = now()
  WHERE user_id = _uid;
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Internal: returns true if PIN matches (or no PIN set & _allow_unset)
CREATE OR REPLACE FUNCTION public._verify_pin_internal(_uid uuid, _pin text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _hash text;
BEGIN
  SELECT transaction_pin_hash INTO _hash FROM public.profiles WHERE user_id = _uid;
  IF _hash IS NULL THEN RETURN _pin IS NULL; END IF;
  IF _pin IS NULL THEN RETURN false; END IF;
  RETURN _hash = crypt(_pin, _hash);
END;
$$;

-- 7. Bump daily usage helper
CREATE OR REPLACE FUNCTION public._bump_daily_usage(_uid uuid, _ngn numeric)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.daily_usage (user_id, usage_date, ngn_outflow, updated_at)
  VALUES (_uid, (now() AT TIME ZONE 'UTC')::date, _ngn, now())
  ON CONFLICT (user_id, usage_date)
  DO UPDATE SET ngn_outflow = public.daily_usage.ngn_outflow + EXCLUDED.ngn_outflow, updated_at = now();
END;
$$;

-- 8. Replace withdraw_ngn with PIN + freeze + limit enforcement
CREATE OR REPLACE FUNCTION public.withdraw_ngn(
  _amount numeric, _fee numeric, _bank_code text, _bank_name text,
  _account_number text, _account_name text, _pin text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _profile RECORD;
  _ngn_wallet_id uuid;
  _current_ngn numeric;
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

  _total_deduction := _amount + _fee;

  -- Limit check (NGN outflow)
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
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  _reference := 'LXP-WD-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 6);

  UPDATE public.ngn_balances SET balance = balance - _total_deduction, updated_at = now() WHERE wallet_id = _ngn_wallet_id;

  INSERT INTO public.withdrawals (user_id, amount, bank_code, bank_name, account_number, account_name, reference, status)
  VALUES (_user_id, _amount, _bank_code, _bank_name, _account_number, _account_name, _reference, 'PROCESSING')
  RETURNING id INTO _withdrawal_id;

  INSERT INTO public.transactions (user_id, kind, title, subtitle, amount_display, status, metadata)
  VALUES (
    _user_id, 'WITHDRAW', 'Bank Transfer', _bank_name || ' • ' || _account_name,
    '-₦' || _total_deduction || ' (sent ₦' || _amount || ', fee ₦' || _fee || ')',
    'PROCESSING',
    jsonb_build_object('withdrawal_id', _withdrawal_id, 'bank_code', _bank_code, 'bank_name', _bank_name,
      'account_number', _account_number, 'account_name', _account_name,
      'amount', _amount, 'fee', _fee, 'reference', _reference)
  );

  PERFORM public._bump_daily_usage(_user_id, _total_deduction);

  -- Treasury entries
  INSERT INTO public.treasury_ledger (entry_type, asset, amount, user_id, reference_id, reference_kind, metadata)
  VALUES
    ('WITHDRAW_OUT', 'NGN', _amount, _user_id, _withdrawal_id, 'withdrawal', jsonb_build_object('reference', _reference)),
    ('FEE_REVENUE', 'NGN', _fee, _user_id, _withdrawal_id, 'withdrawal', jsonb_build_object('source', 'withdraw_fee'));

  RETURN jsonb_build_object('success', true, 'withdrawal_id', _withdrawal_id, 'reference', _reference);
END;
$$;

-- 9. Replace process_internal_transfer with PIN + freeze checks (no NGN limit since crypto)
CREATE OR REPLACE FUNCTION public.process_internal_transfer(
  _recipient_username text, _token text, _network text, _amount numeric,
  _idempotency_key text, _pin text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _sender_id uuid := auth.uid();
  _sender_profile RECORD;
  _recipient_profile RECORD;
  _sender_wallet_id uuid;
  _recipient_wallet_id uuid;
  _sender_balance numeric;
  _recipient_balance_row RECORD;
  _reference text;
  _existing_ref text;
BEGIN
  IF _sender_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Not authenticated'); END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive'); END IF;
  IF _idempotency_key IS NULL OR length(_idempotency_key) < 8 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Idempotency key required');
  END IF;

  SELECT username, is_frozen, transaction_pin_hash INTO _sender_profile
  FROM public.profiles WHERE user_id = _sender_id;
  IF _sender_profile IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Sender profile not found'); END IF;
  IF _sender_profile.is_frozen THEN RETURN jsonb_build_object('success', false, 'error', 'Account frozen. Contact support.'); END IF;
  IF _sender_profile.transaction_pin_hash IS NOT NULL AND NOT public._verify_pin_internal(_sender_id, _pin) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid PIN');
  END IF;

  -- Idempotency
  SELECT metadata->>'reference' INTO _existing_ref
  FROM public.transactions WHERE user_id = _sender_id AND idempotency_key = _idempotency_key LIMIT 1;
  IF _existing_ref IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'reference', _existing_ref, 'duplicate', true);
  END IF;

  _recipient_username := lower(trim(replace(_recipient_username, '@', '')));
  IF lower(_sender_profile.username) = _recipient_username THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot send crypto to yourself');
  END IF;

  SELECT user_id, username, display_name, is_frozen INTO _recipient_profile
  FROM public.profiles WHERE lower(username) = _recipient_username;
  IF _recipient_profile IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'User not found'); END IF;
  IF _recipient_profile.is_frozen THEN RETURN jsonb_build_object('success', false, 'error', 'Recipient account is frozen'); END IF;

  SELECT id INTO _sender_wallet_id FROM public.wallets WHERE user_id = _sender_id AND type = 'CRYPTO';
  SELECT id INTO _recipient_wallet_id FROM public.wallets WHERE user_id = _recipient_profile.user_id AND type = 'CRYPTO';
  IF _sender_wallet_id IS NULL OR _recipient_wallet_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  SELECT balance INTO _sender_balance FROM public.crypto_balances
  WHERE wallet_id = _sender_wallet_id AND token = _token AND network = _network FOR UPDATE;
  IF _sender_balance IS NULL OR _sender_balance < _amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  UPDATE public.crypto_balances SET balance = balance - _amount, updated_at = now()
  WHERE wallet_id = _sender_wallet_id AND token = _token AND network = _network;

  SELECT * INTO _recipient_balance_row FROM public.crypto_balances
  WHERE wallet_id = _recipient_wallet_id AND token = _token AND network = _network FOR UPDATE;

  IF _recipient_balance_row IS NULL THEN
    INSERT INTO public.crypto_balances (wallet_id, token, network, balance)
    VALUES (_recipient_wallet_id, _token, _network, _amount);
  ELSE
    UPDATE public.crypto_balances SET balance = balance + _amount, updated_at = now()
    WHERE wallet_id = _recipient_wallet_id AND token = _token AND network = _network;
  END IF;

  _reference := 'LX-' || lpad(floor(random() * 100000000)::text, 8, '0');

  INSERT INTO public.transactions (user_id, kind, title, subtitle, amount_display, status, metadata, idempotency_key)
  VALUES (_sender_id, 'SEND', 'Sent Crypto', 'To @' || _recipient_profile.username,
    '-' || _amount || ' ' || _token, 'SUCCESS',
    jsonb_build_object('reference', _reference, 'recipient_user_id', _recipient_profile.user_id,
      'recipient_username', _recipient_profile.username, 'token', _token, 'network', _network, 'amount', _amount),
    _idempotency_key);

  INSERT INTO public.transactions (user_id, kind, title, subtitle, amount_display, status, metadata)
  VALUES (_recipient_profile.user_id, 'RECEIVE', 'Received Crypto', 'From @' || _sender_profile.username,
    '+' || _amount || ' ' || _token, 'SUCCESS',
    jsonb_build_object('reference', _reference, 'sender_user_id', _sender_id,
      'sender_username', _sender_profile.username, 'token', _token, 'network', _network, 'amount', _amount));

  RETURN jsonb_build_object('success', true, 'reference', _reference,
    'recipient_username', _recipient_profile.username,
    'recipient_display_name', _recipient_profile.display_name);
END;
$$;

-- 10. Block frozen accounts in conversion quote consumption
CREATE OR REPLACE FUNCTION public.consume_conversion_quote(_quote_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _quote RECORD;
  _profile RECORD;
  _crypto_wallet_id uuid;
  _current_crypto numeric;
  _conversion_id uuid;
BEGIN
  IF _user_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Not authenticated'); END IF;

  SELECT is_frozen INTO _profile FROM public.profiles WHERE user_id = _user_id;
  IF _profile.is_frozen THEN RETURN jsonb_build_object('success', false, 'error', 'Account frozen. Contact support.'); END IF;

  SELECT * INTO _quote FROM public.conversion_quotes WHERE id = _quote_id AND user_id = _user_id FOR UPDATE;
  IF _quote IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Quote not found'); END IF;
  IF _quote.consumed THEN RETURN jsonb_build_object('success', false, 'error', 'Quote already used'); END IF;
  IF _quote.expires_at < now() THEN RETURN jsonb_build_object('success', false, 'error', 'Quote expired. Please refresh the rate.'); END IF;

  SELECT id INTO _crypto_wallet_id FROM public.wallets WHERE user_id = _user_id AND type = 'CRYPTO';
  IF _crypto_wallet_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Crypto wallet not found'); END IF;

  SELECT balance INTO _current_crypto FROM public.crypto_balances
  WHERE wallet_id = _crypto_wallet_id AND token = _quote.token AND network = _quote.network FOR UPDATE;
  IF _current_crypto IS NULL OR _current_crypto < _quote.from_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  UPDATE public.crypto_balances SET balance = balance - _quote.from_amount, updated_at = now()
  WHERE wallet_id = _crypto_wallet_id AND token = _quote.token AND network = _quote.network;

  INSERT INTO public.conversions (user_id, from_token, from_network, from_amount, rate, fee, ngn_amount, status)
  VALUES (_user_id, _quote.token, _quote.network, _quote.from_amount,
          _quote.display_rate, _quote.fee, _quote.ngn_amount, 'PROCESSING')
  RETURNING id INTO _conversion_id;

  UPDATE public.conversion_quotes SET consumed = true, consumed_at = now() WHERE id = _quote_id;

  -- Treasury: spread + fee revenue at lock time
  INSERT INTO public.treasury_ledger (entry_type, asset, amount, user_id, reference_id, reference_kind, metadata)
  VALUES
    ('CONVERSION_SPREAD', 'NGN',
      ROUND((_quote.market_rate - _quote.display_rate) * _quote.from_amount, 2),
      _user_id, _conversion_id, 'conversion',
      jsonb_build_object('token', _quote.token, 'amount', _quote.from_amount, 'spread_pct', _quote.spread_pct)),
    ('FEE_REVENUE', 'NGN', _quote.fee, _user_id, _conversion_id, 'conversion',
      jsonb_build_object('source', 'conversion_fee'));

  RETURN jsonb_build_object('success', true, 'conversion_id', _conversion_id);
END;
$$;

-- 11. Admin: freeze account
CREATE OR REPLACE FUNCTION public.admin_set_account_frozen(_target_user uuid, _frozen boolean, _reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _admin uuid := auth.uid();
BEGIN
  IF NOT public.is_platform_admin(_admin) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  UPDATE public.profiles
  SET is_frozen = _frozen,
      frozen_reason = CASE WHEN _frozen THEN _reason ELSE NULL END,
      frozen_at = CASE WHEN _frozen THEN now() ELSE NULL END,
      updated_at = now()
  WHERE user_id = _target_user;

  INSERT INTO public.admin_audit_log (admin_id, action, target_user_id, target_kind, details)
  VALUES (_admin, CASE WHEN _frozen THEN 'FREEZE_ACCOUNT' ELSE 'UNFREEZE_ACCOUNT' END,
          _target_user, 'profile', jsonb_build_object('reason', _reason));

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 12. Admin: KPI snapshot
CREATE OR REPLACE FUNCTION public.admin_treasury_kpis()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _result jsonb;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  SELECT jsonb_build_object(
    'total_users', (SELECT count(*) FROM public.profiles),
    'frozen_users', (SELECT count(*) FROM public.profiles WHERE is_frozen),
    'verified_users', (SELECT count(*) FROM public.profiles WHERE kyc_tier >= 2),
    'total_ngn_balance', (SELECT COALESCE(sum(balance), 0) FROM public.ngn_balances),
    'deposits_30d', (SELECT COALESCE(sum(amount), 0) FROM public.deposits WHERE status = 'CONFIRMED' AND created_at > now() - interval '30 days'),
    'withdrawals_30d', (SELECT COALESCE(sum(amount), 0) FROM public.withdrawals WHERE status IN ('PROCESSING','SUCCESS') AND created_at > now() - interval '30 days'),
    'fee_revenue_30d', (SELECT COALESCE(sum(amount), 0) FROM public.treasury_ledger WHERE entry_type = 'FEE_REVENUE' AND created_at > now() - interval '30 days'),
    'spread_revenue_30d', (SELECT COALESCE(sum(amount), 0) FROM public.treasury_ledger WHERE entry_type = 'CONVERSION_SPREAD' AND created_at > now() - interval '30 days'),
    'pending_conversions', (SELECT count(*) FROM public.conversions WHERE status = 'PROCESSING'),
    'pending_withdrawals', (SELECT count(*) FROM public.withdrawals WHERE status = 'PROCESSING')
  ) INTO _result;

  RETURN _result;
END;
$$;
