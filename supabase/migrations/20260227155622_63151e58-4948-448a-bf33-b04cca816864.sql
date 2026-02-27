
-- Analytics events table for platform usage tracking
CREATE TABLE public.analytics_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL,
  event_data jsonb DEFAULT '{}',
  user_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_analytics_event_type ON public.analytics_events(event_type);
CREATE INDEX idx_analytics_created_at ON public.analytics_events(created_at DESC);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can insert events
CREATE POLICY "Authenticated users can insert analytics"
ON public.analytics_events FOR INSERT
TO authenticated
WITH CHECK (true);

-- Only admins can read analytics
CREATE POLICY "Admins can view analytics"
ON public.analytics_events FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete analytics
CREATE POLICY "Admins can delete analytics"
ON public.analytics_events FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));
