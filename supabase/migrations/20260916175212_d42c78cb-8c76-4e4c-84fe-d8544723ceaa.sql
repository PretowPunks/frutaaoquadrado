CREATE POLICY "representatives read own invite"
ON public.rep_invites FOR SELECT TO authenticated
USING (accepted_user_id = auth.uid());