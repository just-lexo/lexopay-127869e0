
-- Fix 1: Remove _sender_id parameter from transfer_crypto, use auth.uid() instead
CREATE OR REPLACE FUNCTION public.transfer_crypto(_recipient_username text, _token text, _network text, _amount numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _sender_id uuid := auth.uid();
  _recipient_profile RECORD;
  _sender_wallet_id uuid;
  _recipient_wallet_id uuid;
  _sender_balance numeric;
  _recipient_balance_row RECORD;
  _reference text;
  _sender_username text;
BEGIN
  IF _sender_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF _amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

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

-- Fix 2: Prevent privilege escalation via profiles UPDATE
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update safe profile fields"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id AND
    is_admin = (SELECT p.is_admin FROM public.profiles p WHERE p.user_id = auth.uid())
  );
