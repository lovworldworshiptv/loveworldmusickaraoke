DROP POLICY IF EXISTS "Visitors can log onboarding events" ON public.analytics_events;
CREATE POLICY "Visitors can log onboarding events" ON public.analytics_events
  FOR INSERT TO anon
  WITH CHECK (user_id IS NULL AND event_type IN ('onboarding_view','onboarding_skip','onboarding_complete','onboarding_leave','share_click','app_download_click','share_visit') AND pg_column_size(event_data) < 2000);
