-- Create invite request status enum
CREATE TYPE public.invite_request_status AS ENUM ('PENDING', 'APPROVED', 'DECLINED');

-- Create invite_requests table
CREATE TABLE public.invite_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  username TEXT,
  message TEXT,
  status invite_request_status NOT NULL DEFAULT 'PENDING',
  admin_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invite_requests ENABLE ROW LEVEL SECURITY;

-- Users can insert their own requests
CREATE POLICY "Users can insert their own invite requests"
ON public.invite_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view their own requests
CREATE POLICY "Users can view their own invite requests"
ON public.invite_requests
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all invite requests
CREATE POLICY "Admins can view all invite requests"
ON public.invite_requests
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid() AND profiles.is_admin = true
  )
);

-- Admins can update invite requests
CREATE POLICY "Admins can update invite requests"
ON public.invite_requests
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid() AND profiles.is_admin = true
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_invite_requests_updated_at
BEFORE UPDATE ON public.invite_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add is_read column to feedback table
ALTER TABLE public.feedback ADD COLUMN is_read BOOLEAN NOT NULL DEFAULT false;

-- Create reset_all_users_data function for admin global reset
CREATE OR REPLACE FUNCTION public.reset_all_users_data(_seed_balance boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin_id uuid := auth.uid();
  _is_admin boolean;
BEGIN
  -- Verify caller is admin
  SELECT is_admin INTO _is_admin
  FROM public.profiles
  WHERE user_id = _admin_id;
  
  IF _is_admin IS NOT TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  
  -- Reset ALL crypto balances to 0
  UPDATE public.crypto_balances
  SET balance = 0, updated_at = now();
  
  -- Reset ALL NGN balances to 0
  UPDATE public.ngn_balances
  SET balance = 0, updated_at = now();
  
  -- Delete ALL transactions
  DELETE FROM public.transactions;
  
  -- Delete ALL deposits
  DELETE FROM public.deposits;
  
  -- Delete ALL conversions
  DELETE FROM public.conversions;
  
  -- Delete ALL withdrawals
  DELETE FROM public.withdrawals;
  
  -- Optionally seed demo balance for ALL users
  IF _seed_balance THEN
    UPDATE public.crypto_balances
    SET balance = 100, updated_at = now()
    WHERE token = 'USDT' AND network = 'base';
  END IF;
  
  RETURN jsonb_build_object('success', true);
END;
$$;