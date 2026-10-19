CREATE POLICY "Editors view all videos" ON public.song_videos FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'editor'::app_role));
CREATE POLICY "Editors add videos" ON public.song_videos FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'editor'::app_role));
GRANT SELECT, INSERT ON public.song_videos TO authenticated;