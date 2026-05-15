-- Fix PIN functions to schema-qualify pgcrypto (it lives in extensions schema)
CREATE OR REPLACE FUNCTION public.set_transaction_pin(_pin text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Not authenticated'); END IF;
  IF _pin IS NULL OR _pin !~ '^[0-9]{4,6}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'PIN must be 4-6 digits');
  END IF;
  UPDATE public.profiles
  SET transaction_pin_hash = extensions.crypt(_pin, extensions.gen_salt('bf', 10)),
      pin_set_at = now(),
      updated_at = now()
  WHERE user_id = _uid;
  RETURN jsonb_build_object('success', true);
END; $$;

CREATE OR REPLACE FUNCTION public.change_transaction_pin(_old_pin text, _new_pin text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE _uid uuid := auth.uid(); _hash text;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Not authenticated'); END IF;
  SELECT transaction_pin_hash INTO _hash FROM public.profiles WHERE user_id = _uid;
  IF _hash IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'No PIN set'); END IF;
  IF _hash <> extensions.crypt(_old_pin, _hash) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Current PIN incorrect');
  END IF;
  IF _new_pin !~ '^[0-9]{4,6}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'New PIN must be 4-6 digits');
  END IF;
  UPDATE public.profiles
  SET transaction_pin_hash = extensions.crypt(_new_pin, extensions.gen_salt('bf', 10)),
      pin_set_at = now(),
      updated_at = now()
  WHERE user_id = _uid;
  RETURN jsonb_build_object('success', true);
END; $$;

CREATE OR REPLACE FUNCTION public._verify_pin_internal(_uid uuid, _pin text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE _hash text;
BEGIN
  SELECT transaction_pin_hash INTO _hash FROM public.profiles WHERE user_id = _uid;
  IF _hash IS NULL THEN RETURN _pin IS NULL; END IF;
  IF _pin IS NULL THEN RETURN false; END IF;
  RETURN _hash = extensions.crypt(_pin, _hash);
END; $$;

-- Liquidation queue: admin can mark a withdrawal as success/failed (refunds NGN on failure)
CREATE OR REPLACE FUNCTION public.admin_resolve_withdrawal(_withdrawal_id uuid, _success boolean, _note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _admin uuid := auth.uid();
  _wd RECORD;
  _ngn_wallet uuid;
  _refund numeric;
  _fee numeric;
BEGIN
  IF NOT public.is_platform_admin(_admin) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT * INTO _wd FROM public.withdrawals WHERE id = _withdrawal_id FOR UPDATE;
  IF _wd IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Withdrawal not found'); END IF;
  IF _wd.status NOT IN ('PROCESSING') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already resolved');
  END IF;

  IF _success THEN
    UPDATE public.withdrawals SET status = 'SUCCESS', updated_at = now() WHERE id = _withdrawal_id;
    UPDATE public.transactions SET status = 'SUCCESS'
      WHERE user_id = _wd.user_id AND metadata->>'withdrawal_id' = _withdrawal_id::text;
  ELSE
    -- Refund: pull fee from latest tx metadata
    SELECT (metadata->>'fee')::numeric INTO _fee
    FROM public.transactions
    WHERE user_id = _wd.user_id AND metadata->>'withdrawal_id' = _withdrawal_id::text
    LIMIT 1;
    _refund := _wd.amount + COALESCE(_fee, 0);

    SELECT id INTO _ngn_wallet FROM public.wallets WHERE user_id = _wd.user_id AND type = 'NGN';
    UPDATE public.ngn_balances SET balance = balance + _refund, updated_at = now() WHERE wallet_id = _ngn_wallet;

    UPDATE public.withdrawals SET status = 'FAILED', updated_at = now() WHERE id = _withdrawal_id;
    UPDATE public.transactions SET status = 'FAILED',
      metadata = metadata || jsonb_build_object('refunded', true, 'refund_amount', _refund, 'admin_note', _note)
      WHERE user_id = _wd.user_id AND metadata->>'withdrawal_id' = _withdrawal_id::text;

    INSERT INTO public.notifications (user_id, type, title, message, related_id, related_kind)
    VALUES (_wd.user_id, 'WITHDRAW_FAILED', 'Withdrawal refunded',
      'Your withdrawal of ₦' || _wd.amount || ' could not be completed and was refunded.',
      _withdrawal_id, 'withdrawal');
  END IF;

  INSERT INTO public.admin_audit_log (admin_id, action, target_user_id, target_id, target_kind, details)
  VALUES (_admin, CASE WHEN _success THEN 'WITHDRAW_SUCCESS' ELSE 'WITHDRAW_FAIL' END,
          _wd.user_id, _withdrawal_id, 'withdrawal', jsonb_build_object('note', _note));

  RETURN jsonb_build_object('success', true);
END; $$;