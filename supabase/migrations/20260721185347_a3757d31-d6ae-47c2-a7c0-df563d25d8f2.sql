
-- 1. Fix mutable search_path on pgmq wrapper functions
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;

-- 2. Fix homepage_popup targeting policy
DROP POLICY IF EXISTS "Homepage popup readable except targets" ON public.homepage_popup;
CREATE POLICY "Homepage popup readable by target audience"
ON public.homepage_popup
FOR SELECT
USING (
  COALESCE(target_segment, 'all') = 'all'
  OR (
    auth.uid() IS NOT NULL
    AND (
      target_segment IN ('free', 'trial', 'premium')
      OR (target_segment = 'specific' AND target_user_ids IS NOT NULL AND auth.uid() = ANY(target_user_ids))
    )
  )
);

-- 3. Restrict challenge_scores raw read; expose safe leaderboard via SECURITY DEFINER function
DROP POLICY IF EXISTS "scores_public_read" ON public.challenge_scores;
CREATE POLICY "scores_owner_read"
ON public.challenge_scores
FOR SELECT
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.get_challenge_leaderboard(p_challenge_id uuid, p_limit integer DEFAULT 500)
RETURNS TABLE (
  rank integer,
  is_me boolean,
  username text,
  avatar_url text,
  total_score integer,
  games_played integer,
  qualified boolean,
  final_rank integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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
  ORDER BY cs.total_score DESC
  LIMIT COALESCE(p_limit, 500);
$$;

GRANT EXECUTE ON FUNCTION public.get_challenge_leaderboard(uuid, integer) TO anon, authenticated;
