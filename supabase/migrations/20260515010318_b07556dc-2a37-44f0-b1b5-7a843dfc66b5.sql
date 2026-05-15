
-- 1) Conversion quotes table (locked rates)
CREATE TABLE IF NOT EXISTS public.conversion_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token text NOT NULL,
  network text NOT NULL,
  from_amount numeric NOT NULL CHECK (from_amount > 0),
  market_rate numeric NOT NULL,
  display_rate numeric NOT NULL,
  spread_pct numeric NOT NULL DEFAULT 1.0,
  fee numeric NOT NULL,
  ngn_amount numeric NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed boolean NOT NULL DEFAULT false,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.conversion_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own quotes"
  ON public.conversion_quotes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own quotes"
  ON public.conversion_quotes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_conversion_quotes_user_expires
  ON public.conversion_quotes(user_id, expires_at);

-- 2) Idempotency key on transactions
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_user_idem
  ON public.transactions(user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- 3) consume_conversion_quote RPC
CREATE OR REPLACE FUNCTION public.consume_conversion_quote(_quote_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _quote RECORD;
  _crypto_wallet_id uuid;
  _current_crypto numeric;
  _conversion_id uuid;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO _quote FROM public.conversion_quotes
  WHERE id = _quote_id AND user_id = _user_id
  FOR UPDATE;

  IF _quote IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quote not found');
  END IF;

  IF _quote.consumed THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quote already used');
  END IF;

  IF _quote.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quote expired. Please refresh the rate.');
  END IF;

  SELECT id INTO _crypto_wallet_id FROM public.wallets
  WHERE user_id = _user_id AND type = 'CRYPTO';

  IF _crypto_wallet_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Crypto wallet not found');
  END IF;

  SELECT balance INTO _current_crypto FROM public.crypto_balances
  WHERE wallet_id = _crypto_wallet_id AND token = _quote.token AND network = _quote.network
  FOR UPDATE;

  IF _current_crypto IS NULL OR _current_crypto < _quote.from_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  UPDATE public.crypto_balances
  SET balance = balance - _quote.from_amount, updated_at = now()
  WHERE wallet_id = _crypto_wallet_id AND token = _quote.token AND network = _quote.network;

  INSERT INTO public.conversions (user_id, from_token, from_network, from_amount, rate, fee, ngn_amount, status)
  VALUES (_user_id, _quote.token, _quote.network, _quote.from_amount,
          _quote.display_rate, _quote.fee, _quote.ngn_amount, 'PROCESSING')
  RETURNING id INTO _conversion_id;

  UPDATE public.conversion_quotes
  SET consumed = true, consumed_at = now()
  WHERE id = _quote_id;

  RETURN jsonb_build_object('success', true, 'conversion_id', _conversion_id);
END;
$$;

-- 4) process_internal_transfer RPC (with idempotency)
CREATE OR REPLACE FUNCTION public.process_internal_transfer(
  _recipient_username text,
  _token text,
  _network text,
  _amount numeric,
  _idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sender_id uuid := auth.uid();
  _recipient_profile RECORD;
  _sender_wallet_id uuid;
  _recipient_wallet_id uuid;
  _sender_balance numeric;
  _recipient_balance_row RECORD;
  _reference text;
  _sender_username text;
  _existing_ref text;
BEGIN
  IF _sender_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF _amount IS NULL OR _amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  IF _idempotency_key IS NULL OR length(_idempotency_key) < 8 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Idempotency key required');
  END IF;

  -- Idempotency check: if sender already has a tx with this key, return that result
  SELECT metadata->>'reference' INTO _existing_ref
  FROM public.transactions
  WHERE user_id = _sender_id AND idempotency_key = _idempotency_key
  LIMIT 1;

  IF _existing_ref IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'reference', _existing_ref, 'duplicate', true);
  END IF;

  _recipient_username := lower(trim(replace(_recipient_username, '@', '')));

  SELECT username INTO _sender_username FROM public.profiles WHERE user_id = _sender_id;
  IF _sender_username IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sender profile not found');
  END IF;

  IF lower(_sender_username) = _recipient_username THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot send crypto to yourself');
  END IF;

  SELECT user_id, username, display_name INTO _recipient_profile
  FROM public.profiles WHERE lower(username) = _recipient_username;

  IF _recipient_profile IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  SELECT id INTO _sender_wallet_id FROM public.wallets WHERE user_id = _sender_id AND type = 'CRYPTO';
  SELECT id INTO _recipient_wallet_id FROM public.wallets WHERE user_id = _recipient_profile.user_id AND type = 'CRYPTO';

  IF _sender_wallet_id IS NULL OR _recipient_wallet_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  SELECT balance INTO _sender_balance FROM public.crypto_balances
  WHERE wallet_id = _sender_wallet_id AND token = _token AND network = _network
  FOR UPDATE;

  IF _sender_balance IS NULL OR _sender_balance < _amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  UPDATE public.crypto_balances
  SET balance = balance - _amount, updated_at = now()
  WHERE wallet_id = _sender_wallet_id AND token = _token AND network = _network;

  SELECT * INTO _recipient_balance_row FROM public.crypto_balances
  WHERE wallet_id = _recipient_wallet_id AND token = _token AND network = _network
  FOR UPDATE;

  IF _recipient_balance_row IS NULL THEN
    INSERT INTO public.crypto_balances (wallet_id, token, network, balance)
    VALUES (_recipient_wallet_id, _token, _network, _amount);
  ELSE
    UPDATE public.crypto_balances
    SET balance = balance + _amount, updated_at = now()
    WHERE wallet_id = _recipient_wallet_id AND token = _token AND network = _network;
  END IF;

  _reference := 'LX-' || lpad(floor(random() * 100000000)::text, 8, '0');

  INSERT INTO public.transactions (user_id, kind, title, subtitle, amount_display, status, metadata, idempotency_key)
  VALUES (
    _sender_id, 'SEND', 'Sent Crypto', 'To @' || _recipient_profile.username,
    '-' || _amount || ' ' || _token, 'SUCCESS',
    jsonb_build_object('reference', _reference, 'recipient_user_id', _recipient_profile.user_id,
      'recipient_username', _recipient_profile.username, 'token', _token, 'network', _network, 'amount', _amount),
    _idempotency_key
  );

  INSERT INTO public.transactions (user_id, kind, title, subtitle, amount_display, status, metadata)
  VALUES (
    _recipient_profile.user_id, 'RECEIVE', 'Received Crypto', 'From @' || _sender_username,
    '+' || _amount || ' ' || _token, 'SUCCESS',
    jsonb_build_object('reference', _reference, 'sender_user_id', _sender_id,
      'sender_username', _sender_username, 'token', _token, 'network', _network, 'amount', _amount)
  );

  RETURN jsonb_build_object('success', true, 'reference', _reference,
    'recipient_username', _recipient_profile.username,
    'recipient_display_name', _recipient_profile.display_name);
END;
$$;

-- 5) Realtime
ALTER TABLE public.transactions REPLICA IDENTITY FULL;
ALTER TABLE public.conversions REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversions;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
