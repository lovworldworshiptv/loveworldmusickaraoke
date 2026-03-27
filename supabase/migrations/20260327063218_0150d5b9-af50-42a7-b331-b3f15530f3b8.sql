
-- Fix playlists: replace EXISTS subquery with has_role() SECURITY DEFINER function
DROP POLICY IF EXISTS "All users can view admin playlists" ON public.playlists;
CREATE POLICY "All users can view admin playlists"
  ON public.playlists FOR SELECT
  TO public
  USING (has_role(playlists.user_id, 'admin'::app_role));

-- Fix playlist_songs: replace EXISTS subquery with has_role() SECURITY DEFINER function
DROP POLICY IF EXISTS "All users can view admin playlist songs" ON public.playlist_songs;
CREATE POLICY "All users can view admin playlist songs"
  ON public.playlist_songs FOR SELECT
  TO public
  USING (EXISTS (
    SELECT 1 FROM playlists
    WHERE playlists.id = playlist_songs.playlist_id
      AND has_role(playlists.user_id, 'admin'::app_role)
  ));
