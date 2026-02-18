
-- Create storage bucket for article audio files
INSERT INTO storage.buckets (id, name, public) VALUES ('article-audio', 'article-audio', true)
ON CONFLICT (id) DO NOTHING;

-- Public read policy
CREATE POLICY "Article audio is public" ON storage.objects FOR SELECT USING (bucket_id = 'article-audio');

-- Admin upload policy
CREATE POLICY "Admins can upload article audio" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'article-audio' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- Admin update policy
CREATE POLICY "Admins can update article audio" ON storage.objects FOR UPDATE
USING (bucket_id = 'article-audio' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- Admin delete policy
CREATE POLICY "Admins can delete article audio" ON storage.objects FOR DELETE
USING (bucket_id = 'article-audio' AND public.has_role(auth.uid(), 'admin'::public.app_role));
