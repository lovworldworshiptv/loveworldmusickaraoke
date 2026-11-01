CREATE TABLE public.challenge_leaderboard_archives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL,
  challenge_name text NOT NULL,
  season_start timestamptz,
  season_end timestamptz,
  standings jsonb NOT NULL DEFAULT '[]'::jsonb,
  cleared_by uuid,
  cleared_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.challenge_leaderboard_archives TO authenticated;
GRANT ALL ON public.challenge_leaderboard_archives TO service_role;
ALTER TABLE public.challenge_leaderboard_archives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read leaderboard archives" ON public.challenge_leaderboard_archives
  FOR SELECT TO authenticated USING ((SELECT public.has_role(auth.uid(), 'admin'::app_role)));

-- Admin-only: archive the current standings, then wipe scores, game logs, bonuses and
-- challenge invites so the ladder restarts from zero. Entries (enrolment) are kept.
CREATE OR REPLACE FUNCTION public.reset_challenge_leaderboard(p_challenge_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ch record;
  v_count integer;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can clear a leaderboard';
  END IF;
  SELECT id, name, start_date, end_date INTO v_ch FROM public.challenges WHERE id = p_challenge_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Challenge not found'; END IF;

  SELECT count(*) INTO v_count FROM public.challenge_scores WHERE challenge_id = p_challenge_id;

  INSERT INTO public.challenge_leaderboard_archives (challenge_id, challenge_name, season_start, season_end, standings, cleared_by)
  SELECT v_ch.id, v_ch.name, v_ch.start_date, v_ch.end_date,
    COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.total_score DESC), '[]'::jsonb), auth.uid()
  FROM public.challenge_scores s WHERE s.challenge_id = p_challenge_id;

  DELETE FROM public.challenge_bonuses_awarded WHERE challenge_id = p_challenge_id;
  DELETE FROM public.challenge_referrals WHERE challenge_id = p_challenge_id;
  DELETE FROM public.challenge_game_logs WHERE challenge_id = p_challenge_id;
  DELETE FROM public.challenge_scores WHERE challenge_id = p_challenge_id;

  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.reset_challenge_leaderboard(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_challenge_leaderboard(uuid) TO authenticated, service_role;