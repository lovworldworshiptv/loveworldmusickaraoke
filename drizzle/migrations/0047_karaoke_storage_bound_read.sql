DROP POLICY IF EXISTS "Signed-in users can play karaoke recordings" ON storage.objects;
CREATE POLICY "Owners or live stories can play karaoke recordings" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'karaoke-recordings' AND (
  owner_id = (SELECT auth.uid()::text)
  OR (storage.foldername(name))[1] = (SELECT auth.uid()::text)
  OR EXISTS (SELECT 1 FROM public.karaoke_recordings kr
             WHERE kr.audio_url LIKE '%/karaoke-recordings/' || storage.objects.name
               AND kr.created_at > now() - interval '24 hours')
));