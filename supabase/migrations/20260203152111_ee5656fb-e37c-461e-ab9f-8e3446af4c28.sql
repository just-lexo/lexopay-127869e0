-- Create atomic P2P crypto transfer function
CREATE OR REPLACE FUNCTION public.transfer_crypto(
  _sender_id uuid,
  _recipient_username text,
  _token text,
  _network text,
  _amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _recipient_profile RECORD;
  _sender_wallet_id uuid;
  _recipient_wallet_id uuid;
  _sender_balance numeric;
  _recipient_balance_row RECORD;
  _reference text;
  _sender_username text;
BEGIN
  -- Normalize username (remove @, trim, lowercase)
  _recipient_username := lower(trim(replace(_recipient_username, '@', '')));
  
  -- Get sender's username
  SELECT username INTO _sender_username
  FROM public.profiles
  WHERE user_id = _sender_id;
  
  IF _sender_username IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sender profile not found');
  END IF;
  
  -- Prevent self-transfer
  IF lower(_sender_username) = _recipient_username THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot send crypto to yourself');
  END IF;
  
  -- Lookup recipient by username (case-insensitive)
  SELECT user_id, username, display_name INTO _recipient_profile
  FROM public.profiles
  WHERE lower(username) = _recipient_username;
  
  IF _recipient_profile IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;
  
  -- Get sender's crypto wallet
  SELECT id INTO _sender_wallet_id
  FROM public.wallets
  WHERE user_id = _sender_id AND type = 'CRYPTO';
  
  IF _sender_wallet_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sender wallet not found');
  END IF;
  
  -- Get recipient's crypto wallet
  SELECT id INTO _recipient_wallet_id
  FROM public.wallets
  WHERE user_id = _recipient_profile.user_id AND type = 'CRYPTO';
  
  IF _recipient_wallet_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recipient wallet not found');
  END IF;
  
  -- Check sender balance
  SELECT balance INTO _sender_balance
  FROM public.crypto_balances
  WHERE wallet_id = _sender_wallet_id 
    AND token = _token 
    AND network = _network;
  
  IF _sender_balance IS NULL OR _sender_balance < _amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;
  
  -- Deduct from sender
  UPDATE public.crypto_balances
  SET balance = balance - _amount, updated_at = now()
  WHERE wallet_id = _sender_wallet_id 
    AND token = _token 
    AND network = _network;
  
  -- Check if recipient has balance row for this token/network
  SELECT * INTO _recipient_balance_row
  FROM public.crypto_balances
  WHERE wallet_id = _recipient_wallet_id 
    AND token = _token 
    AND network = _network;
  
  IF _recipient_balance_row IS NULL THEN
    -- Create balance row for recipient
    INSERT INTO public.crypto_balances (wallet_id, token, network, balance)
    VALUES (_recipient_wallet_id, _token, _network, _amount);
  ELSE
    -- Credit recipient
    UPDATE public.crypto_balances
    SET balance = balance + _amount, updated_at = now()
    WHERE wallet_id = _recipient_wallet_id 
      AND token = _token 
      AND network = _network;
  END IF;
  
  -- Generate reference
  _reference := 'LXP-SEND-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 6);
  
  -- Create sender transaction
  INSERT INTO public.transactions (
    user_id, kind, title, subtitle, amount_display, status, metadata
  ) VALUES (
    _sender_id,
    'SEND',
    'Sent Crypto',
    'To @' || _recipient_profile.username,
    '-' || _amount || ' ' || _token,
    'SUCCESS',
    jsonb_build_object(
      'reference', _reference,
      'recipient_user_id', _recipient_profile.user_id,
      'recipient_username', _recipient_profile.username,
      'token', _token,
      'network', _network,
      'amount', _amount
    )
  );
  
  -- Create recipient transaction
  INSERT INTO public.transactions (
    user_id, kind, title, subtitle, amount_display, status, metadata
  ) VALUES (
    _recipient_profile.user_id,
    'RECEIVE',
    'Received Crypto',
    'From @' || _sender_username,
    '+' || _amount || ' ' || _token,
    'SUCCESS',
    jsonb_build_object(
      'reference', _reference,
      'sender_user_id', _sender_id,
      'sender_username', _sender_username,
      'token', _token,
      'network', _network,
      'amount', _amount
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'reference', _reference,
    'recipient_username', _recipient_profile.username,
    'recipient_display_name', _recipient_profile.display_name
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.transfer_crypto TO authenticated;