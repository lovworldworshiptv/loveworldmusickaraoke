
-- Create storage bucket for song audio files
INSERT INTO storage.buckets (id, name, public) VALUES ('song-audio', 'song-audio', true);

-- Create storage bucket for instrumental audio files
INSERT INTO storage.buckets (id, name, public) VALUES ('song-instrumentals', 'song-instrumentals', true);

-- Public read for audio
CREATE POLICY "Audio files are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'song-audio');

-- Admin upload for audio
CREATE POLICY "Admins can upload audio"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'song-audio' AND public.has_role(auth.uid(), 'admin'));

-- Admin delete for audio
CREATE POLICY "Admins can delete audio"
ON storage.objects FOR DELETE
USING (bucket_id = 'song-audio' AND public.has_role(auth.uid(), 'admin'));

-- Admin update for audio
CREATE POLICY "Admins can update audio"
ON storage.objects FOR UPDATE
USING (bucket_id = 'song-audio' AND public.has_role(auth.uid(), 'admin'));

-- Public read for instrumentals
CREATE POLICY "Instrumental files are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'song-instrumentals');

-- Admin upload for instrumentals
CREATE POLICY "Admins can upload instrumentals"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'song-instrumentals' AND public.has_role(auth.uid(), 'admin'));

-- Admin delete for instrumentals
CREATE POLICY "Admins can delete instrumentals"
ON storage.objects FOR DELETE
USING (bucket_id = 'song-instrumentals' AND public.has_role(auth.uid(), 'admin'));

-- Admin update for instrumentals
CREATE POLICY "Admins can update instrumentals"
ON storage.objects FOR UPDATE
USING (bucket_id = 'song-instrumentals' AND public.has_role(auth.uid(), 'admin'));
