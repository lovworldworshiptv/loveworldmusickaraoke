-- Editors manage limited content areas (albums, articles, categories, banners, games, playlists, feedback)
CREATE POLICY "Editors can manage albums" ON public.albums FOR ALL TO authenticated USING (public.has_role(auth.uid(),'editor')) WITH CHECK (public.has_role(auth.uid(),'editor'));
CREATE POLICY "Editors can manage articles" ON public.articles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'editor')) WITH CHECK (public.has_role(auth.uid(),'editor'));
CREATE POLICY "Editors can manage categories" ON public.categories FOR ALL TO authenticated USING (public.has_role(auth.uid(),'editor')) WITH CHECK (public.has_role(auth.uid(),'editor'));
CREATE POLICY "Editors can manage hero banners" ON public.hero_banners FOR ALL TO authenticated USING (public.has_role(auth.uid(),'editor')) WITH CHECK (public.has_role(auth.uid(),'editor'));
CREATE POLICY "Editors can manage game levels" ON public.game_levels FOR ALL TO authenticated USING (public.has_role(auth.uid(),'editor')) WITH CHECK (public.has_role(auth.uid(),'editor'));
CREATE POLICY "Editors can manage quiz questions" ON public.quiz_questions FOR ALL TO authenticated USING (public.has_role(auth.uid(),'editor')) WITH CHECK (public.has_role(auth.uid(),'editor'));
CREATE POLICY "Editors can view all feedback" ON public.feedback FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'editor'));
CREATE POLICY "Editors can reply to feedback" ON public.feedback FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'editor')) WITH CHECK (public.has_role(auth.uid(),'editor'));

-- Official playlists: owned by admins or editors; private user playlists stay hidden from editors
CREATE POLICY "All users can view editor playlists" ON public.playlists FOR SELECT USING (public.has_role(user_id,'editor'));
CREATE POLICY "Editors can view official playlists" ON public.playlists FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'editor') AND public.has_role(user_id,'admin'));
CREATE POLICY "Editors can update official playlists" ON public.playlists FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'editor') AND (public.has_role(user_id,'admin') OR public.has_role(user_id,'editor')));
CREATE POLICY "Editors can delete official playlists" ON public.playlists FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'editor') AND (public.has_role(user_id,'admin') OR public.has_role(user_id,'editor')));
CREATE POLICY "Editors manage official playlist songs" ON public.playlist_songs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'editor') AND EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_id AND (public.has_role(p.user_id,'admin') OR public.has_role(p.user_id,'editor'))))
  WITH CHECK (public.has_role(auth.uid(),'editor') AND EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_id AND (public.has_role(p.user_id,'admin') OR public.has_role(p.user_id,'editor'))));

-- Editor uploads for their content buckets
CREATE POLICY "Editors upload content media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id IN ('album-covers','article-images','article-audio','category-images','game-images','hero-banners','song-covers') AND public.has_role(auth.uid(),'editor'));
CREATE POLICY "Editors update content media" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id IN ('album-covers','article-images','article-audio','category-images','game-images','hero-banners','song-covers') AND public.has_role(auth.uid(),'editor'));
CREATE POLICY "Editors delete content media" ON storage.objects FOR DELETE TO authenticated USING (bucket_id IN ('album-covers','article-images','article-audio','category-images','game-images','hero-banners','song-covers') AND public.has_role(auth.uid(),'editor'));