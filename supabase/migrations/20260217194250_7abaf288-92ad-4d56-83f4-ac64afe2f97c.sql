
-- Allow admins to view all playlists
CREATE POLICY "Admins can view all playlists" ON public.playlists
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to manage all playlists
CREATE POLICY "Admins can update all playlists" ON public.playlists
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete all playlists" ON public.playlists
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create playlists" ON public.playlists
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow admins to manage all playlist_songs
CREATE POLICY "Admins can view all playlist songs" ON public.playlist_songs
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can add to any playlist" ON public.playlist_songs
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update any playlist songs" ON public.playlist_songs
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can remove from any playlist" ON public.playlist_songs
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Set default artist to 'Loveworld Singers' for songs and albums
ALTER TABLE public.songs ALTER COLUMN artist SET DEFAULT 'Loveworld Singers';
ALTER TABLE public.albums ALTER COLUMN artist SET DEFAULT 'Loveworld Singers';
