
-- Table to track unique story views
CREATE TABLE public.karaoke_story_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id uuid NOT NULL REFERENCES public.karaoke_recordings(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(recording_id, viewer_id)
);

ALTER TABLE public.karaoke_story_views ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can insert a view (their own)
CREATE POLICY "Users can insert own views"
  ON public.karaoke_story_views FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = viewer_id);

-- Views are publicly readable (for counts)
CREATE POLICY "Views are publicly readable"
  ON public.karaoke_story_views FOR SELECT
  TO authenticated
  USING (true);
