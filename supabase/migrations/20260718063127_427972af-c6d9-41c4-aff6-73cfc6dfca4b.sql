
-- 1. kingschat_auth_sessions: remove public read; only edge functions (service_role) need it
DROP POLICY IF EXISTS "Anyone can read kc session by nonce" ON public.kingschat_auth_sessions;
REVOKE SELECT ON public.kingschat_auth_sessions FROM anon, authenticated;

-- 2. karaoke_story_views: restrict to viewer or recording owner
DROP POLICY IF EXISTS "Views are publicly readable" ON public.karaoke_story_views;
CREATE POLICY "Viewer or owner can read views"
  ON public.karaoke_story_views
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = viewer_id
    OR EXISTS (
      SELECT 1 FROM public.karaoke_recordings kr
      WHERE kr.id = karaoke_story_views.recording_id
        AND kr.user_id = auth.uid()
    )
  );

-- 3. user_achievements: block self-insert; grant via SECURITY DEFINER function that validates
DROP POLICY IF EXISTS "Users can insert own achievements" ON public.user_achievements;

CREATE OR REPLACE FUNCTION public.claim_achievement(_achievement_key text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user uuid := auth.uid();
  _sessions record;
  _earned boolean := false;
BEGIN
  IF _user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE game_mode='lyrics')   AS lyrics_games,
    COUNT(*) FILTER (WHERE game_mode='melody')   AS melody_games,
    COUNT(*) FILTER (WHERE game_mode='category') AS category_games,
    COUNT(*)                                     AS total_games,
    COALESCE(SUM(score),0)                       AS total_points,
    COALESCE(MAX(best_streak) FILTER (WHERE game_mode='lyrics'),0)   AS lyrics_streak,
    COALESCE(MAX(best_streak) FILTER (WHERE game_mode='melody'),0)   AS melody_streak,
    COALESCE(MAX(best_streak) FILTER (WHERE game_mode='category'),0) AS category_streak
  INTO _sessions
  FROM public.game_sessions
  WHERE user_id = _user;

  _earned := CASE _achievement_key
    WHEN 'lyrics_scholar'  THEN _sessions.lyrics_games   >= 10
    WHEN 'melody_master'   THEN _sessions.melody_games   >= 10
    WHEN 'category_master' THEN _sessions.category_games >= 10
    WHEN 'songs_master'    THEN _sessions.lyrics_games >= 10 AND _sessions.melody_games >= 10 AND _sessions.category_games >= 10
    WHEN 'first_game'      THEN _sessions.total_games >= 1
    WHEN 'points_100'      THEN _sessions.total_points >= 100
    WHEN 'points_500'      THEN _sessions.total_points >= 500
    WHEN 'streak_5'        THEN _sessions.lyrics_streak >= 5 OR _sessions.melody_streak >= 5 OR _sessions.category_streak >= 5
    ELSE false
  END;

  IF NOT _earned THEN
    RETURN false;
  END IF;

  INSERT INTO public.user_achievements (user_id, achievement_key)
  VALUES (_user, _achievement_key)
  ON CONFLICT DO NOTHING;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_achievement(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_achievement(text) TO authenticated;
