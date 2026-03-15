
-- Add wallet_connected_at to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wallet_connected_at timestamptz DEFAULT NULL;

-- Create unique index on wallet_address to prevent duplicate linking
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_wallet_address_unique 
ON public.profiles (wallet_address) 
WHERE wallet_address IS NOT NULL;

-- Create a public lookup function for public profile pages (no auth required)
CREATE OR REPLACE FUNCTION public.lookup_public_profile(_username text)
RETURNS TABLE(username text, display_name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.username, p.display_name
  FROM public.profiles p
  WHERE lower(p.username) = lower(trim(replace(_username, '@', '')))
  LIMIT 1;
$$;

-- Grant execute to anon role so unauthenticated users can view public profiles
GRANT EXECUTE ON FUNCTION public.lookup_public_profile(text) TO anon;
GRANT EXECUTE ON FUNCTION public.lookup_public_profile(text) TO authenticated;
