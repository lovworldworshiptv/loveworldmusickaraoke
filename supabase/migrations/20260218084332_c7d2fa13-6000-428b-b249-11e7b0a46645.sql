
-- Create onboarding splash screens table
CREATE TABLE public.onboarding_screens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.onboarding_screens ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Onboarding screens are public"
  ON public.onboarding_screens
  FOR SELECT
  USING (true);

-- Admin management
CREATE POLICY "Admins can manage onboarding screens"
  ON public.onboarding_screens
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create storage bucket for onboarding images
INSERT INTO storage.buckets (id, name, public) VALUES ('onboarding-images', 'onboarding-images', true);

-- Storage policies
CREATE POLICY "Onboarding images are public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'onboarding-images');

CREATE POLICY "Admins can upload onboarding images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'onboarding-images' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update onboarding images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'onboarding-images' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete onboarding images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'onboarding-images' AND has_role(auth.uid(), 'admin'::app_role));

-- Seed default screens
INSERT INTO public.onboarding_screens (title, subtitle, description, sort_order) VALUES
  ('Welcome to Loveworld Music', 'Your gateway to worship', 'Discover thousands of anointed songs, karaoke tracks, and worship resources from Loveworld Singers.', 0),
  ('Sing Along with Karaoke', 'Instrumental & synced lyrics', 'Follow along with perfectly synced lyrics and instrumentals. Practice your favorite worship songs anytime.', 1),
  ('Join the Community', 'Connect through worship', 'Save favorites, create playlists, and stay updated with the latest releases from Loveworld Singers.', 2);
