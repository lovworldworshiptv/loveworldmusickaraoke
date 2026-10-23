DROP POLICY IF EXISTS "Users can insert own karaoke recordings" ON public.karaoke_recordings;
CREATE POLICY "Users can insert own karaoke recordings"
ON public.karaoke_recordings
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT auth.uid()) = user_id
  AND (
    (SELECT public.has_active_premium((SELECT auth.uid())))
    OR EXISTS (SELECT 1 FROM public.songs s WHERE s.id = song_id AND s.is_free_download)
  )
);