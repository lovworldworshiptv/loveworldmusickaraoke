CREATE OR REPLACE FUNCTION public.has_active_premium(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_subscriptions us
    WHERE us.user_id = _user_id
      AND us.subscription IN ('premium','trial')
      AND (us.subscription_expiry_date IS NULL OR us.subscription_expiry_date > now())
  )
$$;

GRANT EXECUTE ON FUNCTION public.has_active_premium(uuid) TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION public.get_challenge_leaderboard(p_challenge_id uuid, p_limit integer DEFAULT 500)
RETURNS TABLE(rank integer, is_me boolean, username text, avatar_url text, total_score integer, games_played integer, qualified boolean, final_rank integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    (ROW_NUMBER() OVER (ORDER BY cs.total_score DESC))::int AS rank,
    (cs.user_id = auth.uid()) AS is_me,
    COALESCE(p.username, 'User') AS username,
    p.avatar_url,
    cs.total_score,
    cs.games_played,
    cs.qualified,
    cs.final_rank
  FROM public.challenge_scores cs
  LEFT JOIN public.profiles p ON p.user_id = cs.user_id
  WHERE cs.challenge_id = p_challenge_id
    AND public.has_active_premium(cs.user_id)
  ORDER BY cs.total_score DESC
  LIMIT COALESCE(p_limit, 500);
$$;