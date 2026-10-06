CREATE TABLE public.song_motion_artwork (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  video_url TEXT NOT NULL,
  duration_seconds NUMERIC(5,2) NOT NULL CHECK (duration_seconds > 0 AND duration_seconds <= 15),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (song_id)
);

GRANT SELECT ON public.song_motion_artwork TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.song_motion_artwork TO authenticated;
GRANT ALL ON public.song_motion_artwork TO service_role;

ALTER TABLE public.song_motion_artwork ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Motion artwork is publicly readable"
ON public.song_motion_artwork FOR SELECT
TO anon, authenticated
USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert motion artwork"
ON public.song_motion_artwork FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update motion artwork"
ON public.song_motion_artwork FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete motion artwork"
ON public.song_motion_artwork FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX song_motion_artwork_song_active_idx
ON public.song_motion_artwork (song_id, is_active);

COMMENT ON TABLE public.song_motion_artwork IS 'Optional muted looping artwork videos, limited to 15 seconds, kept separate from full song videos.';