
-- =============================================
-- FIX 1: Restrict profiles SELECT policy
-- Replace open "true" policy with own-user + secure username lookup RPC
-- =============================================

-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Users can search profiles by username" ON public.profiles;

-- Users can only read their own profile
CREATE POLICY "Users can read own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = user_id);

-- Secure RPC for username lookup (only returns non-sensitive fields)
CREATE OR REPLACE FUNCTION public.lookup_username(_username text)
RETURNS TABLE(user_id uuid, username text, display_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.username, p.display_name
  FROM public.profiles p
  WHERE lower(p.username) = lower(trim(replace(_username, '@', '')))
  LIMIT 1;
$$;

-- =============================================
-- FIX 2: Add CHECK constraints for positive amounts
-- =============================================

ALTER TABLE public.conversions ADD CONSTRAINT positive_from_amount CHECK (from_amount > 0);
ALTER TABLE public.withdrawals ADD CONSTRAINT positive_withdrawal_amount CHECK (amount > 0);

-- Add positive amount validation to transfer_crypto
CREATE OR REPLACE FUNCTION public.transfer_crypto(_sender_id uuid, _recipient_username text, _token text, _network text, _amount numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _recipient_profile RECORD;
  _sender_wallet_id uuid;
  _recipient_wallet_id uuid;
  _sender_balance numeric;
  _recipient_balance_row RECORD;
  _reference text;
  _sender_username text;
BEGIN
  -- Validate amount is positive
  IF _amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  -- Normalize username
  _recipient_username := lower(trim(replace(_recipient_username, '@', '')));
  
  SELECT username INTO _sender_username
  FROM public.profiles
  WHERE user_id = _sender_id;
  
  IF _sender_username IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sender profile not found');
  END IF;
  
  IF lower(_sender_username) = _recipient_username THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot send crypto to yourself');
  END IF;
  
  SELECT user_id, username, display_name INTO _recipient_profile
  FROM public.profiles
  WHERE lower(username) = _recipient_username;
  
  IF _recipient_profile IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;
  
  SELECT id INTO _sender_wallet_id
  FROM public.wallets
  WHERE user_id = _sender_id AND type = 'CRYPTO';
  
  IF _sender_wallet_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sender wallet not found');
  END IF;
  
  SELECT id INTO _recipient_wallet_id
  FROM public.wallets
  WHERE user_id = _recipient_profile.user_id AND type = 'CRYPTO';
  
  IF _recipient_wallet_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recipient wallet not found');
  END IF;
  
  -- Lock sender balance row to prevent race conditions
  SELECT balance INTO _sender_balance
  FROM public.crypto_balances
  WHERE wallet_id = _sender_wallet_id 
    AND token = _token 
    AND network = _network
  FOR UPDATE;
  
  IF _sender_balance IS NULL OR _sender_balance < _amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;
  
  UPDATE public.crypto_balances
  SET balance = balance - _amount, updated_at = now()
  WHERE wallet_id = _sender_wallet_id 
    AND token = _token 
    AND network = _network;
  
  SELECT * INTO _recipient_balance_row
  FROM public.crypto_balances
  WHERE wallet_id = _recipient_wallet_id 
    AND token = _token 
    AND network = _network
  FOR UPDATE;
  
  IF _recipient_balance_row IS NULL THEN
    INSERT INTO public.crypto_balances (wallet_id, token, network, balance)
    VALUES (_recipient_wallet_id, _token, _network, _amount);
  ELSE
    UPDATE public.crypto_balances
    SET balance = balance + _amount, updated_at = now()
    WHERE wallet_id = _recipient_wallet_id 
      AND token = _token 
      AND network = _network;
  END IF;
  
  _reference := 'LXP-SEND-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 6);
  
  INSERT INTO public.transactions (user_id, kind, title, subtitle, amount_display, status, metadata)
  VALUES (
    _sender_id, 'SEND', 'Sent Crypto', 'To @' || _recipient_profile.username,
    '-' || _amount || ' ' || _token, 'SUCCESS',
    jsonb_build_object('reference', _reference, 'recipient_user_id', _recipient_profile.user_id,
      'recipient_username', _recipient_profile.username, 'token', _token, 'network', _network, 'amount', _amount)
  );
  
  INSERT INTO public.transactions (user_id, kind, title, subtitle, amount_display, status, metadata)
  VALUES (
    _recipient_profile.user_id, 'RECEIVE', 'Received Crypto', 'From @' || _sender_username,
    '+' || _amount || ' ' || _token, 'SUCCESS',
    jsonb_build_object('reference', _reference, 'sender_user_id', _sender_id,
      'sender_username', _sender_username, 'token', _token, 'network', _network, 'amount', _amount)
  );
  
  RETURN jsonb_build_object('success', true, 'reference', _reference,
    'recipient_username', _recipient_profile.username, 'recipient_display_name', _recipient_profile.display_name);
END;
$function$;

-- =============================================
-- FIX 3: Atomic RPC for crypto-to-NGN conversion
-- =============================================

CREATE OR REPLACE FUNCTION public.convert_crypto_to_ngn(
  _token text,
  _network text,
  _amount numeric,
  _rate numeric,
  _fee numeric,
  _net_ngn numeric
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
  _current_ngn numeric;
BEGIN
  IF _amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  IF _net_ngn <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid conversion result');
  END IF;

  -- Get wallet IDs
  SELECT id INTO _crypto_wallet_id FROM public.wallets WHERE user_id = _user_id AND type = 'CRYPTO';
  SELECT id INTO _ngn_wallet_id FROM public.wallets WHERE user_id = _user_id AND type = 'NGN';

  IF _crypto_wallet_id IS NULL OR _ngn_wallet_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallets not found');
  END IF;

  -- Lock and check crypto balance
  SELECT balance INTO _current_crypto
  FROM public.crypto_balances
  WHERE wallet_id = _crypto_wallet_id AND token = _token AND network = _network
  FOR UPDATE;

  IF _current_crypto IS NULL OR _current_crypto < _amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  -- Lock NGN balance
  SELECT balance INTO _current_ngn
  FROM public.ngn_balances
  WHERE wallet_id = _ngn_wallet_id
  FOR UPDATE;

  -- Deduct crypto
  UPDATE public.crypto_balances
  SET balance = balance - _amount, updated_at = now()
  WHERE wallet_id = _crypto_wallet_id AND token = _token AND network = _network;

  -- Add NGN
  UPDATE public.ngn_balances
  SET balance = balance + _net_ngn, updated_at = now()
  WHERE wallet_id = _ngn_wallet_id;

  -- Create conversion record
  INSERT INTO public.conversions (user_id, from_token, from_network, from_amount, rate, fee, ngn_amount, status)
  VALUES (_user_id, _token, _network, _amount, _rate, _fee, _net_ngn, 'SUCCESS');

  -- Create transaction record
  INSERT INTO public.transactions (user_id, kind, title, subtitle, amount_display, status, metadata)
  VALUES (
    _user_id, 'CONVERT', 'Crypto Conversion', _token || ' to NGN',
    '-' || _amount || ' ' || _token || ' → +₦' || _net_ngn || ' (fee: ₦' || _fee || ')',
    'SUCCESS',
    jsonb_build_object('from_amount', _amount, 'from_token', _token, 'from_network', _network,
      'rate', _rate, 'fee', _fee, 'ngn_amount', _net_ngn)
  );

  RETURN jsonb_build_object('success', true);
END;
$function$;

-- =============================================
-- FIX 4: Atomic RPC for NGN withdrawal
-- =============================================

CREATE OR REPLACE FUNCTION public.withdraw_ngn(
  _amount numeric,
  _fee numeric,
  _bank_code text,
  _bank_name text,
  _account_number text,
  _account_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _ngn_wallet_id uuid;
  _current_ngn numeric;
  _total_deduction numeric;
  _reference text;
  _withdrawal_id uuid;
BEGIN
  IF _amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  _total_deduction := _amount + _fee;

  -- Get NGN wallet
  SELECT id INTO _ngn_wallet_id FROM public.wallets WHERE user_id = _user_id AND type = 'NGN';

  IF _ngn_wallet_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  -- Lock and check balance
  SELECT balance INTO _current_ngn
  FROM public.ngn_balances
  WHERE wallet_id = _ngn_wallet_id
  FOR UPDATE;

  IF _current_ngn IS NULL OR _current_ngn < _total_deduction THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  _reference := 'LXP-WD-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 6);

  -- Deduct balance
  UPDATE public.ngn_balances
  SET balance = balance - _total_deduction, updated_at = now()
  WHERE wallet_id = _ngn_wallet_id;

  -- Create withdrawal record
  INSERT INTO public.withdrawals (user_id, amount, bank_code, bank_name, account_number, account_name, reference, status)
  VALUES (_user_id, _amount, _bank_code, _bank_name, _account_number, _account_name, _reference, 'PROCESSING')
  RETURNING id INTO _withdrawal_id;

  -- Create transaction record
  INSERT INTO public.transactions (user_id, kind, title, subtitle, amount_display, status, metadata)
  VALUES (
    _user_id, 'WITHDRAW', 'Bank Transfer', _bank_name || ' • ' || _account_name,
    '-₦' || _total_deduction || ' (sent ₦' || _amount || ', fee ₦' || _fee || ')',
    'PROCESSING',
    jsonb_build_object('withdrawal_id', _withdrawal_id, 'bank_code', _bank_code, 'bank_name', _bank_name,
      'account_number', _account_number, 'account_name', _account_name, 'amount', _amount, 'fee', _fee, 'reference', _reference)
  );

  RETURN jsonb_build_object('success', true, 'withdrawal_id', _withdrawal_id, 'reference', _reference);
END;
$function$;
