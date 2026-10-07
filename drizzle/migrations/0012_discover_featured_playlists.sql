ALTER TABLE public.discover_featured ADD COLUMN IF NOT EXISTS song_ids uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE public.discover_featured ADD COLUMN IF NOT EXISTS description text;
CREATE POLICY "Editors manage featured items" ON public.discover_featured FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'editor'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'editor'::app_role));