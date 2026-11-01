ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS milestones jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS prize_min_milestones integer NOT NULL DEFAULT 2;

UPDATE public.challenges
SET milestones = jsonb_build_array(jsonb_build_object('score', referral_gate_score, 'invites', COALESCE(referral_gate_required_invites, 0)))
WHERE referral_gate_score IS NOT NULL AND milestones = '[]'::jsonb;

ALTER TABLE public.challenges
  ADD CONSTRAINT challenges_prize_min_milestones_nonneg CHECK (prize_min_milestones >= 0);

COMMENT ON COLUMN public.challenges.referral_gate_score IS 'DEPRECATED: replaced by milestones';
COMMENT ON COLUMN public.challenges.referral_gate_required_invites IS 'DEPRECATED: replaced by milestones';