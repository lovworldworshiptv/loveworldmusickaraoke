CREATE TABLE public.discover_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text,
  route text NOT NULL DEFAULT '/',
  gradient_from text NOT NULL DEFAULT '#1e3a8a',
  gradient_to text NOT NULL DEFAULT '#0f172a',
  gradient_via text,
  text_color text NOT NULL DEFAULT '#FFFFFF',
  image_url text,
  image_alt text,
  is_hero boolean NOT NULL DEFAULT false,
  is_visible boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.discover_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discover_categories TO authenticated;
GRANT ALL ON public.discover_categories TO service_role;
ALTER TABLE public.discover_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Visible discover categories are public" ON public.discover_categories FOR SELECT USING (is_visible OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage discover categories" ON public.discover_categories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER discover_categories_updated BEFORE UPDATE ON public.discover_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.discover_featured (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  media_type text NOT NULL DEFAULT 'image' CHECK (media_type IN ('image','video')),
  image_url text,
  video_url text,
  poster_url text,
  href text,
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.discover_featured TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discover_featured TO authenticated;
GRANT ALL ON public.discover_featured TO service_role;
ALTER TABLE public.discover_featured ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active featured items are public" ON public.discover_featured FOR SELECT USING (
  (is_active AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now()))
  OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage featured items" ON public.discover_featured FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER discover_featured_updated BEFORE UPDATE ON public.discover_featured FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();