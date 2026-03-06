ALTER TABLE public.playlists
ADD COLUMN IF NOT EXISTS is_visible_on_homepage boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_playlists_visible_homepage
ON public.playlists (is_visible_on_homepage, created_at);