GRANT INSERT ON public.analytics_events TO anon;
CREATE POLICY "Visitors can log onboarding events" ON public.analytics_events
  FOR INSERT TO anon
  WITH CHECK (user_id IS NULL AND event_type IN ('onboarding_view','onboarding_skip','onboarding_complete','onboarding_leave') AND pg_column_size(event_data) < 2000);
CREATE INDEX IF NOT EXISTS analytics_events_type_created_idx ON public.analytics_events (event_type, created_at DESC);