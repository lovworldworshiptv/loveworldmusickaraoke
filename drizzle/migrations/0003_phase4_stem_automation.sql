-- lovable-cron-fallback-reviewed: Replicate separation has no webhook path to this backend; wake-on-enqueue, worker unschedules after queue drains
ALTER TABLE public.song_audio_versions
  ADD COLUMN IF NOT EXISTS prediction_id text,
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS started_at timestamptz;

CREATE TABLE IF NOT EXISTS public.stem_worker_state (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  lease_until timestamptz,
  paused_reason text,
  paused_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.stem_worker_state TO authenticated;
GRANT ALL ON public.stem_worker_state TO service_role;
ALTER TABLE public.stem_worker_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read stem worker state" ON public.stem_worker_state
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.stem_worker_state (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.stem_worker_acquire(p_seconds integer DEFAULT 55)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ok boolean;
BEGIN
  UPDATE public.stem_worker_state SET lease_until = now() + make_interval(secs => p_seconds), updated_at = now()
   WHERE id = 1 AND (lease_until IS NULL OR lease_until < now())
  RETURNING true INTO ok;
  RETURN COALESCE(ok, false);
END $$;
REVOKE EXECUTE ON FUNCTION public.stem_worker_acquire(integer) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.stem_queue_wake()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.status = 'pending' AND NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'stem-worker') THEN
    BEGIN
      PERFORM cron.schedule('stem-worker', '* * * * *', $cron$
        SELECT net.http_post(
          url := 'https://qphlczkvepcxzgqagsmx.supabase.co/functions/v1/stem-worker',
          headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwaGxjemt2ZXBjeHpncWFnc214Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMTQwMjUsImV4cCI6MjA4Njc5MDAyNX0.0v4obQK2sBXjcO2RhR9Vcl2mJ4b4zZq21mW2qHvrr4Q"}'::jsonb,
          body := '{}'::jsonb);
      $cron$);
    EXCEPTION WHEN OTHERS THEN RAISE WARNING 'stem_queue_wake: %', SQLERRM;
    END;
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.stem_queue_disarm()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.song_audio_versions WHERE status IN ('pending','processing') AND kind = 'instrumental') THEN
    BEGIN PERFORM cron.unschedule('stem-worker'); EXCEPTION WHEN OTHERS THEN NULL; END;
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.stem_queue_disarm() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_stem_queue_wake ON public.song_audio_versions;
CREATE TRIGGER trg_stem_queue_wake AFTER INSERT OR UPDATE OF status ON public.song_audio_versions
  FOR EACH ROW EXECUTE FUNCTION public.stem_queue_wake();

CREATE OR REPLACE FUNCTION public.songs_enqueue_stems()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.audio_url IS NOT NULL AND NEW.instrumental_url IS NULL
     AND (TG_OP = 'INSERT' OR NEW.audio_url IS DISTINCT FROM OLD.audio_url) THEN
    INSERT INTO public.song_audio_versions (song_id, language_code, kind, status, source)
    VALUES (NEW.id, COALESCE(NEW.original_language, 'en'), 'instrumental', 'pending', 'auto')
    ON CONFLICT (song_id, language_code, kind) DO UPDATE
      SET status = 'pending', attempts = 0, error = NULL, prediction_id = NULL
      WHERE public.song_audio_versions.status = 'failed';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_songs_enqueue_stems ON public.songs;
CREATE TRIGGER trg_songs_enqueue_stems AFTER INSERT OR UPDATE OF audio_url ON public.songs
  FOR EACH ROW EXECUTE FUNCTION public.songs_enqueue_stems();