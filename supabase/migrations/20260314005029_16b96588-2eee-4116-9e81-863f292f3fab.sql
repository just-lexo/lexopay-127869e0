
-- Create payment_request_status enum
CREATE TYPE public.payment_request_status AS ENUM ('PENDING', 'PAID', 'DECLINED', 'EXPIRED');

-- Create payment_requests table
CREATE TABLE public.payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  note text,
  status payment_request_status NOT NULL DEFAULT 'PENDING',
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;

-- RLS: requester can read their own requests
CREATE POLICY "Requester can read own requests"
  ON public.payment_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = requester_id);

-- RLS: recipient can read requests sent to them
CREATE POLICY "Recipient can read requests to them"
  ON public.payment_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = recipient_id);

-- RLS: authenticated users can insert (requester_id must match)
CREATE POLICY "Users can create payment requests"
  ON public.payment_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = requester_id);

-- RLS: recipient can update (pay/decline)
CREATE POLICY "Recipient can update request status"
  ON public.payment_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = recipient_id);

-- RLS: requester can also update (e.g. cancel - future)
CREATE POLICY "Requester can update own request"
  ON public.payment_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = requester_id);

-- Create RPC to pay a payment request (handles NGN transfers atomically)
CREATE OR REPLACE FUNCTION public.pay_payment_request(_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _req RECORD;
  _ngn_wallet_id uuid;
  _requester_ngn_wallet_id uuid;
  _current_ngn numeric;
  _reference text;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Lock the request row
  SELECT * INTO _req
  FROM public.payment_requests
  WHERE id = _request_id
  FOR UPDATE;

  IF _req IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found');
  END IF;

  IF _req.recipient_id != _user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  IF _req.status != 'PENDING' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request is no longer pending');
  END IF;

  IF _req.expires_at < now() THEN
    UPDATE public.payment_requests SET status = 'EXPIRED', updated_at = now() WHERE id = _request_id;
    RETURN jsonb_build_object('success', false, 'error', 'Request has expired');
  END IF;

  -- Only NGN payments supported for now
  IF _req.asset != 'NGN' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only NGN payments supported via this RPC');
  END IF;

  -- Get payer NGN wallet
  SELECT id INTO _ngn_wallet_id FROM public.wallets WHERE user_id = _user_id AND type = 'NGN';
  IF _ngn_wallet_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payer wallet not found');
  END IF;

  -- Get requester NGN wallet
  SELECT id INTO _requester_ngn_wallet_id FROM public.wallets WHERE user_id = _req.requester_id AND type = 'NGN';
  IF _requester_ngn_wallet_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Requester wallet not found');
  END IF;

  -- Lock and check payer balance
  SELECT balance INTO _current_ngn FROM public.ngn_balances WHERE wallet_id = _ngn_wallet_id FOR UPDATE;
  IF _current_ngn IS NULL OR _current_ngn < _req.amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient NGN balance', 'available', COALESCE(_current_ngn, 0));
  END IF;

  _reference := 'LX-' || lpad(floor(random() * 100000000)::text, 8, '0');

  -- Deduct from payer
  UPDATE public.ngn_balances SET balance = balance - _req.amount, updated_at = now() WHERE wallet_id = _ngn_wallet_id;

  -- Credit requester
  UPDATE public.ngn_balances SET balance = balance + _req.amount, updated_at = now() WHERE wallet_id = _requester_ngn_wallet_id;

  -- Mark request as paid
  UPDATE public.payment_requests SET status = 'PAID', updated_at = now() WHERE id = _request_id;

  -- Create transaction for payer
  INSERT INTO public.transactions (user_id, kind, title, subtitle, amount_display, status, metadata)
  VALUES (
    _user_id, 'SEND', 'Payment Request', 'Paid request',
    '-₦' || _req.amount, 'SUCCESS',
    jsonb_build_object('reference', _reference, 'payment_request_id', _request_id,
      'requester_id', _req.requester_id, 'asset', _req.asset, 'amount', _req.amount, 'note', _req.note)
  );

  -- Create transaction for requester
  INSERT INTO public.transactions (user_id, kind, title, subtitle, amount_display, status, metadata)
  VALUES (
    _req.requester_id, 'RECEIVE', 'Payment Received', 'Request fulfilled',
    '+₦' || _req.amount, 'SUCCESS',
    jsonb_build_object('reference', _reference, 'payment_request_id', _request_id,
      'payer_id', _user_id, 'asset', _req.asset, 'amount', _req.amount, 'note', _req.note)
  );

  RETURN jsonb_build_object('success', true, 'reference', _reference);
END;
$$;
