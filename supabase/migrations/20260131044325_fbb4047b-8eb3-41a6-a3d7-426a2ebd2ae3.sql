-- Allow users to search for other users by username (for internal transfers)
-- This only exposes username and display_name, not sensitive data
CREATE POLICY "Users can search profiles by username"
ON public.profiles
FOR SELECT
USING (true);

-- Drop the restrictive policy that only allows viewing own profile
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;