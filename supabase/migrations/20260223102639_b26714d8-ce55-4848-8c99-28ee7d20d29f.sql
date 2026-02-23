
-- Create premium_ads table
CREATE TABLE public.premium_ads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  subtitle text,
  description text,
  image_url text,
  cta_text text DEFAULT 'Get Premium',
  link_url text,
  placement text NOT NULL DEFAULT 'secondary_banner',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.premium_ads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage premium ads" ON public.premium_ads FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Premium ads are public" ON public.premium_ads FOR SELECT
  USING (true);

-- Add RLS policy so all users can see admin playlists (where admin created them)
CREATE POLICY "All users can view admin playlists" ON public.playlists FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = playlists.user_id AND user_roles.role = 'admin'
    )
  );

-- Allow all users to view songs in admin playlists
CREATE POLICY "All users can view admin playlist songs" ON public.playlist_songs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.playlists
      JOIN public.user_roles ON user_roles.user_id = playlists.user_id AND user_roles.role = 'admin'
      WHERE playlists.id = playlist_songs.playlist_id
    )
  );
