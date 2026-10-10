CREATE UNIQUE INDEX IF NOT EXISTS downloads_user_song_uidx ON public.downloads(user_id, song_id);
GRANT SELECT, INSERT, DELETE ON public.downloads TO authenticated;
GRANT ALL ON public.downloads TO service_role;
CREATE POLICY "Users can delete own downloads" ON public.downloads FOR DELETE TO authenticated USING (auth.uid() = user_id);