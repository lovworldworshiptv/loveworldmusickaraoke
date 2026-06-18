
CREATE POLICY "Admins can view all playlists" ON public.playlists FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update any playlist" ON public.playlists FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete any playlist" ON public.playlists FOR DELETE USING (public.has_role(auth.uid(), 'admin'));
