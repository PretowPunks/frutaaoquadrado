DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

CREATE POLICY "Users can view own profile or admin can view all"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));