-- Phase 3B: Private Alpha + Trust Layer

-- 1. Add is_admin column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- 2. Create allowlist_type enum
DO $$ BEGIN
  CREATE TYPE public.allowlist_type AS ENUM ('EMAIL', 'USERNAME');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. Create allowlist table
CREATE TABLE IF NOT EXISTS public.allowlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  type public.allowlist_type NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(identifier, type)
);

-- Enable RLS
ALTER TABLE public.allowlist ENABLE ROW LEVEL SECURITY;

-- Allowlist policies: authenticated users can read, only admins can modify
CREATE POLICY "Authenticated users can read allowlist"
  ON public.allowlist FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert allowlist entries"
  ON public.allowlist FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Admins can update allowlist entries"
  ON public.allowlist FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Admins can delete allowlist entries"
  ON public.allowlist FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- 4. Create feedback_category enum
DO $$ BEGIN
  CREATE TYPE public.feedback_category AS ENUM ('BUG', 'IDEA', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 5. Create feedback table
CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category public.feedback_category NOT NULL,
  message text NOT NULL,
  page text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Feedback policies: users can insert and read their own feedback
CREATE POLICY "Users can insert their own feedback"
  ON public.feedback FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own feedback"
  ON public.feedback FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all feedback
CREATE POLICY "Admins can view all feedback"
  ON public.feedback FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- 6. Create function to set first user as admin
CREATE OR REPLACE FUNCTION public.set_first_user_as_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If no admin exists yet, make this user admin
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE is_admin = true) THEN
    NEW.is_admin := true;
  END IF;
  RETURN NEW;
END;
$$;

-- 7. Create trigger to auto-set first user as admin on profile insert
DROP TRIGGER IF EXISTS set_first_admin_trigger ON public.profiles;
CREATE TRIGGER set_first_admin_trigger
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_first_user_as_admin();

-- 8. Create RPC function for admin to reset user demo data
CREATE OR REPLACE FUNCTION public.reset_demo_data(
  _seed_balance boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _crypto_wallet_id uuid;
  _ngn_wallet_id uuid;
BEGIN
  -- Get wallet IDs
  SELECT id INTO _crypto_wallet_id
  FROM public.wallets
  WHERE user_id = _user_id AND type = 'CRYPTO';
  
  SELECT id INTO _ngn_wallet_id
  FROM public.wallets
  WHERE user_id = _user_id AND type = 'NGN';
  
  IF _crypto_wallet_id IS NULL OR _ngn_wallet_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallets not found');
  END IF;
  
  -- Reset crypto balances to 0
  UPDATE public.crypto_balances
  SET balance = 0, updated_at = now()
  WHERE wallet_id = _crypto_wallet_id;
  
  -- Reset NGN balance to 0
  UPDATE public.ngn_balances
  SET balance = 0, updated_at = now()
  WHERE wallet_id = _ngn_wallet_id;
  
  -- Delete user's transactions
  DELETE FROM public.transactions WHERE user_id = _user_id;
  
  -- Delete user's deposits
  DELETE FROM public.deposits WHERE user_id = _user_id;
  
  -- Delete user's conversions
  DELETE FROM public.conversions WHERE user_id = _user_id;
  
  -- Delete user's withdrawals
  DELETE FROM public.withdrawals WHERE user_id = _user_id;
  
  -- Optionally seed demo balance
  IF _seed_balance THEN
    UPDATE public.crypto_balances
    SET balance = 100, updated_at = now()
    WHERE wallet_id = _crypto_wallet_id AND token = 'USDT' AND network = 'base';
  END IF;
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.reset_demo_data TO authenticated;

-- 9. Update RLS for deposits, conversions, withdrawals to allow DELETE for own records
CREATE POLICY "Users can delete their own deposits"
  ON public.deposits FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversions"
  ON public.conversions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own withdrawals"
  ON public.withdrawals FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own transactions"
  ON public.transactions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);