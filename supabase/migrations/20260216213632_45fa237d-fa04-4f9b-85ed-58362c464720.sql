
-- Create albums table
CREATE TABLE public.albums (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT NOT NULL DEFAULT '',
  cover_url TEXT,
  is_top BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.albums ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Albums are public" ON public.albums FOR SELECT USING (true);
CREATE POLICY "Admins can manage albums" ON public.albums FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add album_id FK to songs
ALTER TABLE public.songs ADD COLUMN album_id UUID REFERENCES public.albums(id) ON DELETE SET NULL;

-- Create storage bucket for album covers
INSERT INTO storage.buckets (id, name, public) VALUES ('album-covers', 'album-covers', true);

CREATE POLICY "Album covers are public" ON storage.objects FOR SELECT USING (bucket_id = 'album-covers');
CREATE POLICY "Admins can upload album covers" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'album-covers' AND public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update album covers" ON storage.objects FOR UPDATE USING (bucket_id = 'album-covers' AND public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete album covers" ON storage.objects FOR DELETE USING (bucket_id = 'album-covers' AND public.has_role(auth.uid(), 'admin'::app_role));
