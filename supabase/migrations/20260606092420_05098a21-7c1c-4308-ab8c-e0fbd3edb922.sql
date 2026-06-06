
-- 1. profiles: espees balance
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS espees_balance numeric NOT NULL DEFAULT 0;

-- 2. challenges
CREATE TABLE IF NOT EXISTS public.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  entry_fee numeric NOT NULL DEFAULT 1,
  prize_pool numeric NOT NULL DEFAULT 100,
  prize_distribution jsonb NOT NULL DEFAULT '{"1":70,"2":20,"3":10}'::jsonb,
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  max_daily_scoring_games integer,
  max_referrals_per_user integer DEFAULT 10,
  qualification_min_games integer NOT NULL DEFAULT 10,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.challenges TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenges TO authenticated;
GRANT ALL ON public.challenges TO service_role;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "challenges_public_read" ON public.challenges FOR SELECT USING (status IN ('active','completed'));
CREATE POLICY "challenges_admin_all" ON public.challenges FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_challenges_updated BEFORE UPDATE ON public.challenges FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. challenge_entries
CREATE TABLE IF NOT EXISTS public.challenge_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  payment_proof_url text,
  paid_amount numeric NOT NULL DEFAULT 0,
  is_premium_free boolean NOT NULL DEFAULT false,
  referred_by_user_id uuid,
  admin_notes text,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, user_id)
);
GRANT SELECT, INSERT, UPDATE ON public.challenge_entries TO authenticated;
GRANT ALL ON public.challenge_entries TO service_role;
ALTER TABLE public.challenge_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "entries_own_select" ON public.challenge_entries FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "entries_own_insert" ON public.challenge_entries FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "entries_admin_update" ON public.challenge_entries FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_entries_updated BEFORE UPDATE ON public.challenge_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. challenge_scores
CREATE TABLE IF NOT EXISTS public.challenge_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  total_score integer NOT NULL DEFAULT 0,
  games_played integer NOT NULL DEFAULT 0,
  lyrics_points integer NOT NULL DEFAULT 0,
  melody_points integer NOT NULL DEFAULT 0,
  category_points integer NOT NULL DEFAULT 0,
  qualified boolean NOT NULL DEFAULT false,
  final_rank integer,
  prize_awarded numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, user_id)
);
GRANT SELECT ON public.challenge_scores TO anon;
GRANT SELECT ON public.challenge_scores TO authenticated;
GRANT ALL ON public.challenge_scores TO service_role;
ALTER TABLE public.challenge_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scores_public_read" ON public.challenge_scores FOR SELECT USING (true);
CREATE POLICY "scores_admin_all" ON public.challenge_scores FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
CREATE TRIGGER trg_scores_updated BEFORE UPDATE ON public.challenge_scores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. challenge_game_logs
CREATE TABLE IF NOT EXISTS public.challenge_game_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  mode text NOT NULL,
  difficulty text,
  score integer NOT NULL DEFAULT 0,
  counted_toward_score boolean NOT NULL DEFAULT true,
  completed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.challenge_game_logs TO authenticated;
GRANT ALL ON public.challenge_game_logs TO service_role;
ALTER TABLE public.challenge_game_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "logs_own_select" ON public.challenge_game_logs FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role));
CREATE INDEX IF NOT EXISTS idx_logs_challenge_user_day ON public.challenge_game_logs(challenge_id, user_id, completed_at);

-- 6. challenge_bonuses_awarded
CREATE TABLE IF NOT EXISTS public.challenge_bonuses_awarded (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  bonus_key text NOT NULL,
  points integer NOT NULL,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, user_id, bonus_key)
);
GRANT SELECT ON public.challenge_bonuses_awarded TO authenticated;
GRANT ALL ON public.challenge_bonuses_awarded TO service_role;
ALTER TABLE public.challenge_bonuses_awarded ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bonuses_own_select" ON public.challenge_bonuses_awarded FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role));

-- 7. challenge_referrals
CREATE TABLE IF NOT EXISTS public.challenge_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  referrer_user_id uuid NOT NULL,
  referred_user_id uuid NOT NULL,
  awarded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, referred_user_id),
  CHECK (referrer_user_id <> referred_user_id)
);
GRANT SELECT ON public.challenge_referrals TO authenticated;
GRANT ALL ON public.challenge_referrals TO service_role;
ALTER TABLE public.challenge_referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "referrals_own_select" ON public.challenge_referrals FOR SELECT TO authenticated USING (referrer_user_id = auth.uid() OR referred_user_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role));
