
-- Table to track recently played songs per user
CREATE TABLE public.recently_played (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  song_id uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  played_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_recently_played_user ON public.recently_played(user_id, played_at DESC);

ALTER TABLE public.recently_played ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own history" ON public.recently_played
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own history" ON public.recently_played
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own history" ON public.recently_played
  FOR DELETE USING (auth.uid() = user_id);

-- Feedback table
CREATE TABLE public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can submit feedback" ON public.feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own feedback" ON public.feedback
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all feedback" ON public.feedback
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
