
CREATE TABLE public.karaoke_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id uuid NOT NULL REFERENCES public.karaoke_recordings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  comment text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.karaoke_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view karaoke comments" ON public.karaoke_comments
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can comment" ON public.karaoke_comments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments" ON public.karaoke_comments
  FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "App settings are public" ON public.app_settings
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage app settings" ON public.app_settings
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.app_settings (key, value) VALUES ('karaoke_stories_visible', 'true'::jsonb);
