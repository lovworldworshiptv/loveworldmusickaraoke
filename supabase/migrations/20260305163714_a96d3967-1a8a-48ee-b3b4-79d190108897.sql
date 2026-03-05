
-- Karaoke recordings table
CREATE TABLE public.karaoke_recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  song_id uuid REFERENCES public.songs(id) ON DELETE CASCADE NOT NULL,
  song_title text NOT NULL,
  audio_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.karaoke_recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own karaoke recordings" ON public.karaoke_recordings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own karaoke recordings" ON public.karaoke_recordings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own karaoke recordings" ON public.karaoke_recordings FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Public can view recent karaoke recordings" ON public.karaoke_recordings FOR SELECT USING (created_at > now() - interval '24 hours');

-- Storage bucket for karaoke recordings
INSERT INTO storage.buckets (id, name, public) VALUES ('karaoke-recordings', 'karaoke-recordings', true);

CREATE POLICY "Users can upload karaoke" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'karaoke-recordings' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can delete own karaoke" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'karaoke-recordings' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Karaoke recordings are public" ON storage.objects FOR SELECT USING (bucket_id = 'karaoke-recordings');

-- Homepage popup targeting
ALTER TABLE public.homepage_popup ADD COLUMN IF NOT EXISTS target_segment text NOT NULL DEFAULT 'all';
ALTER TABLE public.homepage_popup ADD COLUMN IF NOT EXISTS target_user_ids uuid[] DEFAULT NULL;

-- Public profile functions (bypass RLS)
CREATE OR REPLACE FUNCTION public.get_public_profile(p_user_id uuid)
RETURNS TABLE(user_id uuid, username text, avatar_url text, kingschat_handle text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT p.user_id, p.username, p.avatar_url, p.kingschat_handle
  FROM public.profiles p
  WHERE p.user_id = p_user_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_public_recently_played(p_user_id uuid, p_limit int DEFAULT 5)
RETURNS TABLE(song_id uuid, played_at timestamptz, title text, artist text, cover_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT rp.song_id, rp.played_at, s.title, s.artist, s.cover_url
  FROM public.recently_played rp
  JOIN public.songs s ON s.id = rp.song_id
  WHERE rp.user_id = p_user_id
  ORDER BY rp.played_at DESC
  LIMIT p_limit;
$$;

-- Public karaoke recordings function
CREATE OR REPLACE FUNCTION public.get_public_karaoke(p_user_id uuid)
RETURNS TABLE(id uuid, song_id uuid, song_title text, audio_url text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT kr.id, kr.song_id, kr.song_title, kr.audio_url, kr.created_at
  FROM public.karaoke_recordings kr
  WHERE kr.user_id = p_user_id AND kr.created_at > now() - interval '24 hours'
  ORDER BY kr.created_at DESC;
$$;
