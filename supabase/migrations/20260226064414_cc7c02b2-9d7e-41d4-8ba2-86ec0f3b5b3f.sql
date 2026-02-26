
-- Add free download toggle for songs
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS is_free_download boolean NOT NULL DEFAULT false;
