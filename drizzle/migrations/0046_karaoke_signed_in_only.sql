DROP POLICY IF EXISTS "Public can view recent karaoke recordings" ON public.karaoke_recordings;
CREATE POLICY "Signed-in users can view recent karaoke recordings" ON public.karaoke_recordings FOR SELECT TO authenticated USING (created_at > (now() - interval '24 hours'));
DROP POLICY IF EXISTS "Anyone can view karaoke comments" ON public.karaoke_comments;
CREATE POLICY "Signed-in users can view karaoke comments" ON public.karaoke_comments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Karaoke recordings are public" ON storage.objects;
CREATE POLICY "Signed-in users can play karaoke recordings" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'karaoke-recordings');
REVOKE EXECUTE ON FUNCTION public.get_public_karaoke(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_public_karaoke(uuid) TO authenticated;