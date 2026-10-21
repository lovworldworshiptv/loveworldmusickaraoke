CREATE POLICY "Editors update videos" ON public.song_videos FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'editor'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'editor'::app_role));
GRANT UPDATE ON public.song_videos TO authenticated;