
-- Create app_settings table for persistent config
CREATE TABLE IF NOT EXISTS public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL DEFAULT 'false'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read settings
CREATE POLICY "Anyone can read settings"
ON public.app_settings FOR SELECT
TO authenticated
USING (true);

-- Only admins can update
CREATE POLICY "Admins can update settings"
ON public.app_settings FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.is_admin = true));

-- Only admins can insert
CREATE POLICY "Admins can insert settings"
ON public.app_settings FOR INSERT
TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.is_admin = true));

-- Seed maintenance_mode
INSERT INTO public.app_settings (key, value) VALUES ('maintenance_mode', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Allow admins to read all profiles for admin panel
CREATE POLICY "Admins can read all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.is_admin = true));

-- Allow admins to read all transactions
CREATE POLICY "Admins can read all transactions"
ON public.transactions FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.is_admin = true));

-- Allow admins to read all deposits
CREATE POLICY "Admins can read all deposits"
ON public.deposits FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.is_admin = true));

-- Allow admins to read all conversions
CREATE POLICY "Admins can read all conversions"
ON public.conversions FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.is_admin = true));

-- Allow admins to read all withdrawals
CREATE POLICY "Admins can read all withdrawals"
ON public.withdrawals FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.is_admin = true));

-- Allow admins to read all KYC submissions
CREATE POLICY "Admins can read all kyc submissions"
ON public.kyc_submissions FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.is_admin = true));
