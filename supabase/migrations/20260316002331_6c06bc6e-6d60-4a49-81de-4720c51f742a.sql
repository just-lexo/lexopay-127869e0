
CREATE TABLE public.saved_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  bank_name text NOT NULL,
  bank_code text NOT NULL,
  account_number text NOT NULL,
  account_name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  is_verified_owner boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own bank accounts"
  ON public.saved_bank_accounts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bank accounts"
  ON public.saved_bank_accounts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bank accounts"
  ON public.saved_bank_accounts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own bank accounts"
  ON public.saved_bank_accounts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
