-- Create storage bucket for song cover art
INSERT INTO storage.buckets (id, name, public) VALUES ('song-covers', 'song-covers', true);

-- Allow anyone to view song covers
CREATE POLICY "Song covers are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'song-covers');

-- Allow admins to upload song covers
CREATE POLICY "Admins can upload song covers"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'song-covers'
  AND public.has_role(auth.uid(), 'admin')
);

-- Allow admins to update song covers
CREATE POLICY "Admins can update song covers"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'song-covers'
  AND public.has_role(auth.uid(), 'admin')
);

-- Allow admins to delete song covers
CREATE POLICY "Admins can delete song covers"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'song-covers'
  AND public.has_role(auth.uid(), 'admin')
);

-- Create articles table
CREATE TABLE public.articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  excerpt TEXT,
  author TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Devotional',
  image_url TEXT,
  video_url TEXT,
  audio_url TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

-- Anyone can read published articles
CREATE POLICY "Published articles are public"
ON public.articles FOR SELECT
USING (is_published = true);

-- Admins can do everything
CREATE POLICY "Admins can manage articles"
ON public.articles FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_articles_updated_at
BEFORE UPDATE ON public.articles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Admin policies for songs table (so admin can update lyrics_lrc, cover_url etc)
CREATE POLICY "Admins can insert songs"
ON public.songs FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update songs"
ON public.songs FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete songs"
ON public.songs FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Admin policies for categories
CREATE POLICY "Admins can manage categories"
ON public.categories FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
