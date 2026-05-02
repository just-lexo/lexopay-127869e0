-- Helper: check if a given user is admin via profiles.is_admin (security definer, bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id AND is_admin = true
  )
$$;

-- PROFILES: replace has_role-based admin policy with is_platform_admin
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;

CREATE POLICY "Admins can read all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_platform_admin(auth.uid()));

-- SUPPORT TICKETS: replace has_role-based admin policies
DROP POLICY IF EXISTS "Admins can view all tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Admins can update all tickets" ON public.support_tickets;

CREATE POLICY "Admins can view all tickets"
ON public.support_tickets
FOR SELECT
TO authenticated
USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "Admins can update all tickets"
ON public.support_tickets
FOR UPDATE
TO authenticated
USING (public.is_platform_admin(auth.uid()));