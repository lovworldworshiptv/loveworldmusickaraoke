-- CRITICAL: Remove the dangerous INSERT policy on user_roles that allows privilege escalation
DROP POLICY IF EXISTS "System inserts roles" ON public.user_roles;

-- Only the handle_new_user trigger (SECURITY DEFINER) should insert roles
-- No direct INSERT policy needed since the trigger runs as superuser

-- Restrict profiles: users can only see their own profile, not all profiles
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = user_id);

-- Allow admins to view all profiles for admin panel
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));
