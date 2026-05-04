
-- 1. Drop direct balance UPDATE policies on financial tables
DROP POLICY IF EXISTS "Users can update their own crypto balances" ON public.crypto_balances;
DROP POLICY IF EXISTS "Users can update their own NGN balance" ON public.ngn_balances;
DROP POLICY IF EXISTS "Users can update their own ngn balance" ON public.ngn_balances;
DROP POLICY IF EXISTS "Users can update own crypto balances" ON public.crypto_balances;
DROP POLICY IF EXISTS "Users can update own ngn balance" ON public.ngn_balances;

-- Also drop INSERT policies on these tables (only initialize_user_wallets / RPCs should insert)
DROP POLICY IF EXISTS "Users can insert their own crypto balances" ON public.crypto_balances;
DROP POLICY IF EXISTS "Users can insert their own NGN balance" ON public.ngn_balances;
DROP POLICY IF EXISTS "Users can insert own crypto balances" ON public.crypto_balances;
DROP POLICY IF EXISTS "Users can insert own ngn balance" ON public.ngn_balances;

-- Also drop direct INSERT on conversions (must go through RPC)
DROP POLICY IF EXISTS "Users can insert their own conversions" ON public.conversions;
DROP POLICY IF EXISTS "Users can insert own conversions" ON public.conversions;

-- 2. Replace convert_crypto_to_ngn with a server-trusted version
DROP FUNCTION IF EXISTS public.convert_crypto_to_ngn(text, text, numeric, numeric, numeric, numeric);

CREATE OR REPLACE FUNCTION public.convert_crypto_to_ngn(
  _token text,
  _network text,
  _amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _crypto_wallet_id uuid;
  _ngn_wallet_id uuid;
  _current_crypto numeric;
  _usd_per_token numeric;
  _usd_to_ngn numeric := 1580;          -- server-controlled reference rate
  _spread_pct numeric := 1.5;            -- server-controlled spread
  _fee_pct numeric := 1.5;               -- server-controlled fee
  _rate numeric;
  _gross_ngn numeric;
  _fee numeric;
  _net_ngn numeric;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF _amount IS NULL OR _amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  -- Only stablecoins are supported for synchronous conversion.
  -- Other tokens must use the async processor (request_crypto_conversion).
  IF upper(_token) NOT IN ('USDT', 'USDC') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Use async conversion for non-stablecoin tokens');
  END IF;

  _usd_per_token := 1.0;
  _rate := _usd_per_token * _usd_to_ngn * (1 - _spread_pct / 100);
  _gross_ngn := _amount * _rate;
  _fee := round((_gross_ngn * _fee_pct / 100)::numeric, 2);
  _net_ngn := round((_gross_ngn - _fee)::numeric, 2);

  IF _net_ngn <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount too small');
  END IF;

  SELECT id INTO _crypto_wallet_id FROM public.wallets WHERE user_id = _user_id AND type = 'CRYPTO';
  SELECT id INTO _ngn_wallet_id FROM public.wallets WHERE user_id = _user_id AND type = 'NGN';

  IF _crypto_wallet_id IS NULL OR _ngn_wallet_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallets not found');
  END IF;

  SELECT balance INTO _current_crypto
  FROM public.crypto_balances
  WHERE wallet_id = _crypto_wallet_id AND token = _token AND network = _network
  FOR UPDATE;

  IF _current_crypto IS NULL OR _current_crypto < _amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  PERFORM 1 FROM public.ngn_balances WHERE wallet_id = _ngn_wallet_id FOR UPDATE;

  UPDATE public.crypto_balances
  SET balance = balance - _amount, updated_at = now()
  WHERE wallet_id = _crypto_wallet_id AND token = _token AND network = _network;

  UPDATE public.ngn_balances
  SET balance = balance + _net_ngn, updated_at = now()
  WHERE wallet_id = _ngn_wallet_id;

  INSERT INTO public.conversions (user_id, from_token, from_network, from_amount, rate, fee, ngn_amount, status)
  VALUES (_user_id, _token, _network, _amount, _rate, _fee, _net_ngn, 'SUCCESS');

  INSERT INTO public.transactions (user_id, kind, title, subtitle, amount_display, status, metadata)
  VALUES (
    _user_id, 'CONVERT', 'Crypto Conversion', _token || ' to NGN',
    '-' || _amount || ' ' || _token || ' → +₦' || _net_ngn || ' (fee: ₦' || _fee || ')',
    'SUCCESS',
    jsonb_build_object('from_amount', _amount, 'from_token', _token, 'from_network', _network,
      'rate', _rate, 'fee', _fee, 'ngn_amount', _net_ngn)
  );

  RETURN jsonb_build_object('success', true, 'rate', _rate, 'fee', _fee, 'ngn_amount', _net_ngn);
END;
$function$;

-- 3. Create RPC for async conversion lock (used by background processor flow)
CREATE OR REPLACE FUNCTION public.request_crypto_conversion(
  _token text,
  _network text,
  _amount numeric,
  _estimated_rate numeric,
  _estimated_fee numeric,
  _estimated_ngn numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _crypto_wallet_id uuid;
  _current_crypto numeric;
  _conversion_id uuid;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF _amount IS NULL OR _amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  SELECT id INTO _crypto_wallet_id FROM public.wallets WHERE user_id = _user_id AND type = 'CRYPTO';
  IF _crypto_wallet_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Crypto wallet not found');
  END IF;

  SELECT balance INTO _current_crypto
  FROM public.crypto_balances
  WHERE wallet_id = _crypto_wallet_id AND token = _token AND network = _network
  FOR UPDATE;

  IF _current_crypto IS NULL OR _current_crypto < _amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  -- Lock the funds
  UPDATE public.crypto_balances
  SET balance = balance - _amount, updated_at = now()
  WHERE wallet_id = _crypto_wallet_id AND token = _token AND network = _network;

  -- Create pending conversion (the edge function will recompute rate server-side and credit NGN)
  INSERT INTO public.conversions (user_id, from_token, from_network, from_amount, rate, fee, ngn_amount, status)
  VALUES (_user_id, _token, _network, _amount,
          COALESCE(_estimated_rate, 0),
          COALESCE(_estimated_fee, 0),
          COALESCE(_estimated_ngn, 0),
          'PROCESSING')
  RETURNING id INTO _conversion_id;

  RETURN jsonb_build_object('success', true, 'conversion_id', _conversion_id);
END;
$function$;

-- 4. Allow admins to manage user_roles
CREATE POLICY "Admins can insert user roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Admins can update user roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "Admins can delete user roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Admins can view all user roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));
