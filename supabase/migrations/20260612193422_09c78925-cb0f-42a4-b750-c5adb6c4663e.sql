
ALTER TABLE public.challenge_entries ADD COLUMN IF NOT EXISTS zone TEXT;

CREATE POLICY "entries_own_delete" ON public.challenge_entries
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "entries_admin_delete" ON public.challenge_entries
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
