CREATE OR REPLACE FUNCTION public.add_play_seconds(p_song_id uuid, p_seconds integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR COALESCE(p_seconds,0) <= 0 THEN RETURN; END IF;
  SELECT id INTO v_id FROM public.play_events
   WHERE user_id = auth.uid() AND song_id = p_song_id AND created_at > now() - interval '4 hours'
   ORDER BY created_at DESC LIMIT 1;
  IF v_id IS NULL THEN RETURN; END IF;
  UPDATE public.play_events SET seconds_played = LEAST(7200, seconds_played + LEAST(p_seconds, 600)) WHERE id = v_id;
END $$;
GRANT EXECUTE ON FUNCTION public.add_play_seconds(uuid, integer) TO authenticated;

CREATE TABLE public.app_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  platform text NOT NULL DEFAULT 'web',
  started_at timestamptz NOT NULL DEFAULT now(),
  seconds integer NOT NULL DEFAULT 0
);
CREATE INDEX app_sessions_user_started ON public.app_sessions (user_id, started_at DESC);
CREATE INDEX app_sessions_started ON public.app_sessions (started_at DESC);
GRANT SELECT ON public.app_sessions TO authenticated;
GRANT ALL ON public.app_sessions TO service_role;
ALTER TABLE public.app_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read app sessions" ON public.app_sessions FOR SELECT TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin')));

CREATE OR REPLACE FUNCTION public.start_app_session(p_platform text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.app_sessions (user_id, platform)
  VALUES (auth.uid(), CASE WHEN p_platform IN ('web','android','ios','pwa') THEN p_platform ELSE 'web' END)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
GRANT EXECUTE ON FUNCTION public.start_app_session(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.add_session_seconds(p_session_id uuid, p_seconds integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL OR COALESCE(p_seconds,0) <= 0 THEN RETURN; END IF;
  UPDATE public.app_sessions SET seconds = LEAST(86400, seconds + LEAST(p_seconds, 600))
   WHERE id = p_session_id AND user_id = auth.uid() AND started_at > now() - interval '1 day';
END $$;
GRANT EXECUTE ON FUNCTION public.add_session_seconds(uuid, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_listening_stats(p_days integer DEFAULT NULL, p_user_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_since timestamptz := CASE WHEN p_days IS NULL THEN '-infinity'::timestamptz ELSE now() - make_interval(days => p_days) END;
  v_listen bigint; v_sessions bigint; v_session_secs bigint;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not allowed'; END IF;
  SELECT COALESCE(sum(seconds_played),0) INTO v_listen FROM public.play_events
   WHERE created_at >= v_since AND (p_user_id IS NULL OR user_id = p_user_id);
  SELECT count(*), COALESCE(sum(seconds),0) INTO v_sessions, v_session_secs FROM public.app_sessions
   WHERE started_at >= v_since AND (p_user_id IS NULL OR user_id = p_user_id);
  RETURN jsonb_build_object('listen_seconds', v_listen, 'sessions', v_sessions,
    'session_seconds', v_session_secs,
    'avg_session_seconds', CASE WHEN v_sessions > 0 THEN round(v_session_secs::numeric / v_sessions) ELSE 0 END);
END $$;
GRANT EXECUTE ON FUNCTION public.admin_listening_stats(integer, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_video_comment(p_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE c public.video_comments; v_replies int;
BEGIN
  SELECT * INTO c FROM public.video_comments WHERE id = p_id;
  IF NOT FOUND THEN RETURN 'missing'; END IF;
  IF auth.uid() IS NULL OR (c.user_id <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  SELECT count(*) INTO v_replies FROM public.video_comments WHERE parent_id = p_id;
  IF v_replies > 0 THEN
    PERFORM set_config('lw.counter', '1', true);
    UPDATE public.video_comments SET body = 'Comment deleted', is_deleted = true, updated_at = now() WHERE id = p_id;
    RETURN 'soft';
  END IF;
  DELETE FROM public.video_comments WHERE id = p_id;
  RETURN 'hard';
END $$;
GRANT EXECUTE ON FUNCTION public.delete_video_comment(uuid) TO authenticated;

-- scrub text of comments already soft-deleted
SELECT set_config('lw.counter', '1', true);
UPDATE public.video_comments SET body = 'Comment deleted' WHERE is_deleted = true AND body <> 'Comment deleted';