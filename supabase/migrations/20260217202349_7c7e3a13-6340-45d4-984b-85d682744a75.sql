
-- Storage buckets for article images, category images, hero banners
INSERT INTO storage.buckets (id, name, public) VALUES ('article-images', 'article-images', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('category-images', 'category-images', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('hero-banners', 'hero-banners', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('game-images', 'game-images', true) ON CONFLICT (id) DO NOTHING;

-- Public read policies for all new buckets
CREATE POLICY "Public read article-images" ON storage.objects FOR SELECT USING (bucket_id = 'article-images');
CREATE POLICY "Admin upload article-images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'article-images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin update article-images" ON storage.objects FOR UPDATE USING (bucket_id = 'article-images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin delete article-images" ON storage.objects FOR DELETE USING (bucket_id = 'article-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Public read category-images" ON storage.objects FOR SELECT USING (bucket_id = 'category-images');
CREATE POLICY "Admin upload category-images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'category-images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin update category-images" ON storage.objects FOR UPDATE USING (bucket_id = 'category-images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin delete category-images" ON storage.objects FOR DELETE USING (bucket_id = 'category-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Public read hero-banners" ON storage.objects FOR SELECT USING (bucket_id = 'hero-banners');
CREATE POLICY "Admin upload hero-banners" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'hero-banners' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin update hero-banners" ON storage.objects FOR UPDATE USING (bucket_id = 'hero-banners' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin delete hero-banners" ON storage.objects FOR DELETE USING (bucket_id = 'hero-banners' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Public read game-images" ON storage.objects FOR SELECT USING (bucket_id = 'game-images');
CREATE POLICY "Admin upload game-images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'game-images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin update game-images" ON storage.objects FOR UPDATE USING (bucket_id = 'game-images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin delete game-images" ON storage.objects FOR DELETE USING (bucket_id = 'game-images' AND public.has_role(auth.uid(), 'admin'));

-- Hero banners table
CREATE TABLE public.hero_banners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT,
  image_url TEXT,
  link_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.hero_banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hero banners are public" ON public.hero_banners FOR SELECT USING (true);
CREATE POLICY "Admins can manage hero banners" ON public.hero_banners FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add image_url to game_levels
ALTER TABLE public.game_levels ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Admin manage game_levels
CREATE POLICY "Admins can manage game levels" ON public.game_levels FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admin manage quiz questions
CREATE POLICY "Admins can manage quiz questions" ON public.quiz_questions FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
