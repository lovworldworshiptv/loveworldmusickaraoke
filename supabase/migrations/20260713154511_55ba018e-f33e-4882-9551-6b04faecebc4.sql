
ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS allowed_subscriptions text[] NOT NULL DEFAULT ARRAY['free','trial','premium']::text[],
  ADD COLUMN IF NOT EXISTS referral_gate_score integer,
  ADD COLUMN IF NOT EXISTS referral_gate_required_invites integer NOT NULL DEFAULT 3;

ALTER TABLE public.challenge_scores
  ADD COLUMN IF NOT EXISTS articles_points integer NOT NULL DEFAULT 0;
