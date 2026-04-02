
-- Add onboarding_completed to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- Mark existing users who already have a username as onboarding completed
UPDATE public.profiles SET onboarding_completed = true WHERE username IS NOT NULL;

-- Add unique constraint on wallet_address (ignore nulls)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_wallet_address_unique ON public.profiles (wallet_address) WHERE wallet_address IS NOT NULL;
