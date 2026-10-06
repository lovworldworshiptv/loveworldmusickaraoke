-- Songs extensions (play_count already exists and is reused as total plays)
ALTER TABLE public.songs
  ADD COLUMN IF NOT EXISTS original_language text NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS dominant_color text,
  ADD COLUMN IF NOT EXISTS total_sung integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS has_video boolean NOT NULL DEFAULT false;

-- Languages
CREATE TABLE public.languages (
  code text PRIMARY KEY,
  name text NOT NULL,
  native_name text NOT NULL,
  is_rtl boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.languages TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.languages TO authenticated;
GRANT ALL ON public.languages TO service_role;
ALTER TABLE public.languages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Languages readable by all" ON public.languages FOR SELECT USING (true);
CREATE POLICY "Admins manage languages" ON public.languages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Song lyrics (multi-language)
CREATE TABLE public.song_lyrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  language_code text NOT NULL REFERENCES public.languages(code),
  lyrics_lrc text,
  lyrics_text text,
  is_machine_translated boolean NOT NULL DEFAULT false,
  is_verified boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (song_id, language_code)
);
GRANT SELECT ON public.song_lyrics TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.song_lyrics TO authenticated;
GRANT ALL ON public.song_lyrics TO service_role;
ALTER TABLE public.song_lyrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lyrics readable by all" ON public.song_lyrics FOR SELECT USING (true);
CREATE POLICY "Admins and editors manage lyrics" ON public.song_lyrics FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'));
CREATE TRIGGER trg_song_lyrics_updated BEFORE UPDATE ON public.song_lyrics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Song audio versions (per language, full / instrumental / stems)
CREATE TABLE public.song_audio_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  language_code text NOT NULL REFERENCES public.languages(code),
  kind text NOT NULL DEFAULT 'full' CHECK (kind IN ('full','instrumental','vocals','guide')),
  audio_url text,
  status text NOT NULL DEFAULT 'ready' CHECK (status IN ('pending','processing','ready','failed')),
  error text,
  bitrate_kbps integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (song_id, language_code, kind)
);
GRANT SELECT ON public.song_audio_versions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.song_audio_versions TO authenticated;
GRANT ALL ON public.song_audio_versions TO service_role;
ALTER TABLE public.song_audio_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Audio versions readable by all" ON public.song_audio_versions FOR SELECT USING (true);
CREATE POLICY "Admins manage audio versions" ON public.song_audio_versions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_song_audio_versions_updated BEFORE UPDATE ON public.song_audio_versions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Song videos
CREATE TABLE public.song_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  language_code text NOT NULL DEFAULT 'en' REFERENCES public.languages(code),
  video_type text NOT NULL DEFAULT 'official' CHECK (video_type IN ('official','lyric','live','karaoke')),
  video_url text NOT NULL,
  thumbnail_url text,
  duration_seconds integer,
  offset_ms integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.song_videos TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.song_videos TO authenticated;
GRANT ALL ON public.song_videos TO service_role;
ALTER TABLE public.song_videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active videos readable by all" ON public.song_videos FOR SELECT
  USING (is_active OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage videos" ON public.song_videos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Play events (write via RPC only; admins read)
CREATE TABLE public.play_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  song_id uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'song' CHECK (mode IN ('song','karaoke','video')),
  language_code text,
  seconds_played integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_play_events_song_time ON public.play_events (song_id, created_at DESC);
CREATE INDEX idx_play_events_user_time ON public.play_events (user_id, created_at DESC);
GRANT SELECT ON public.play_events TO authenticated;
GRANT ALL ON public.play_events TO service_role;
ALTER TABLE public.play_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read play events" ON public.play_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- User preferences
CREATE TABLE public.user_preferences (
  user_id uuid PRIMARY KEY,
  preferred_languages text[] NOT NULL DEFAULT ARRAY['en'],
  favorite_moods text[] NOT NULL DEFAULT '{}',
  data_saver boolean NOT NULL DEFAULT false,
  default_mode text NOT NULL DEFAULT 'song' CHECK (default_mode IN ('song','karaoke','video')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_preferences TO authenticated;
GRANT ALL ON public.user_preferences TO service_role;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own preferences" ON public.user_preferences FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_user_preferences_updated BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Daily discover
CREATE TABLE public.daily_discover (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  discover_date date NOT NULL DEFAULT current_date,
  song_id uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, discover_date)
);
GRANT SELECT ON public.daily_discover TO authenticated;
GRANT ALL ON public.daily_discover TO service_role;
ALTER TABLE public.daily_discover ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own discover" ON public.daily_discover FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- RPC: record_play
CREATE OR REPLACE FUNCTION public.record_play(p_song_id uuid, p_mode text DEFAULT 'song', p_seconds integer DEFAULT 0, p_language text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_mode NOT IN ('song','karaoke','video') THEN p_mode := 'song'; END IF;
  INSERT INTO public.play_events (user_id, song_id, mode, language_code, seconds_played)
  VALUES (auth.uid(), p_song_id, p_mode, p_language, GREATEST(0, LEAST(COALESCE(p_seconds,0), 7200)));
  UPDATE public.songs
     SET play_count = play_count + 1,
         total_sung = total_sung + CASE WHEN p_mode = 'karaoke' THEN 1 ELSE 0 END
   WHERE id = p_song_id;
END $$;

-- RPC: get_trending
CREATE OR REPLACE FUNCTION public.get_trending(p_days integer DEFAULT 7, p_limit integer DEFAULT 20)
RETURNS TABLE(song_id uuid, plays bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT pe.song_id, COUNT(*) AS plays
  FROM public.play_events pe
  WHERE pe.created_at > now() - make_interval(days => GREATEST(1, p_days))
  GROUP BY pe.song_id
  ORDER BY plays DESC
  LIMIT LEAST(COALESCE(p_limit,20), 100);
$$;

-- RPC: get_quick_picks (personal recent + trending, fallback to featured)
CREATE OR REPLACE FUNCTION public.get_quick_picks(p_limit integer DEFAULT 16)
RETURNS TABLE(song_id uuid, source text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH mine AS (
    SELECT pe.song_id, MAX(pe.created_at) AS last_at
    FROM public.play_events pe
    WHERE auth.uid() IS NOT NULL AND pe.user_id = auth.uid()
    GROUP BY pe.song_id ORDER BY last_at DESC LIMIT 8
  ), trend AS (
    SELECT t.song_id FROM public.get_trending(7, 30) t
  ), combined AS (
    SELECT song_id, 'recent'::text AS source, 1 AS pri FROM mine
    UNION ALL SELECT song_id, 'trending', 2 FROM trend
    UNION ALL SELECT id, 'featured', 3 FROM public.songs WHERE is_featured OR is_top
  )
  SELECT DISTINCT ON (c.song_id) c.song_id, c.source
  FROM combined c
  ORDER BY c.song_id, c.pri
  LIMIT LEAST(COALESCE(p_limit,16), 40);
$$;

-- RPC: get_daily_discover (stable pick per user per day)
CREATE OR REPLACE FUNCTION public.get_daily_discover()
RETURNS TABLE(song_id uuid, reason text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _u uuid := auth.uid(); _song uuid; _reason text; _last_title text;
BEGIN
  IF _u IS NOT NULL THEN
    RETURN QUERY SELECT d.song_id, d.reason FROM public.daily_discover d
      WHERE d.user_id = _u AND d.discover_date = current_date;
    IF FOUND THEN RETURN; END IF;

    SELECT s.title INTO _last_title FROM public.play_events pe JOIN public.songs s ON s.id = pe.song_id
      WHERE pe.user_id = _u ORDER BY pe.created_at DESC LIMIT 1;

    SELECT s.id INTO _song FROM public.songs s
      WHERE s.audio_url IS NOT NULL
        AND s.id NOT IN (SELECT pe.song_id FROM public.play_events pe WHERE pe.user_id = _u)
      ORDER BY md5(s.id::text || current_date::text || _u::text) LIMIT 1;
    IF _song IS NULL THEN
      SELECT s.id INTO _song FROM public.songs s WHERE s.audio_url IS NOT NULL
        ORDER BY md5(s.id::text || current_date::text || _u::text) LIMIT 1;
    END IF;
    IF _song IS NULL THEN RETURN; END IF;
    _reason := CASE WHEN _last_title IS NOT NULL THEN 'Because you listened to ' || _last_title ELSE 'Picked for you today' END;
    INSERT INTO public.daily_discover (user_id, song_id, reason) VALUES (_u, _song, _reason)
      ON CONFLICT (user_id, discover_date) DO NOTHING;
    RETURN QUERY SELECT _song, _reason;
  ELSE
    RETURN QUERY SELECT s.id, 'Song of the day'::text FROM public.songs s
      WHERE s.audio_url IS NOT NULL ORDER BY md5(s.id::text || current_date::text) LIMIT 1;
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.record_play(uuid,text,integer,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_play(uuid,text,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_trending(integer,integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_quick_picks(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_daily_discover() TO anon, authenticated;