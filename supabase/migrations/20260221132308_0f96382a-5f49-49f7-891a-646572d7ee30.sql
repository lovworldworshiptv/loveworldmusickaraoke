
ALTER TABLE public.hero_banners
  ADD COLUMN description text DEFAULT NULL,
  ADD COLUMN cta_text text DEFAULT 'Listen Now',
  ADD COLUMN show_cta boolean NOT NULL DEFAULT true;
