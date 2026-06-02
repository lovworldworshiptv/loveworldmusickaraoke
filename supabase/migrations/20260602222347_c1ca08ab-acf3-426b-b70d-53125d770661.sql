
-- 1) Restrict homepage_popup target_user_ids exposure via a public view
DROP POLICY IF EXISTS "Homepage popup is public" ON public.homepage_popup;

CREATE OR REPLACE VIEW public.homepage_popup_public
WITH (security_invoker = on) AS
SELECT id, enabled, homepage_only, delay_seconds, show_frequency, title, description,
       image_url, image_position, primary_button_text, primary_button_url, primary_button_new_tab,
       secondary_button_text, secondary_button_url, secondary_button_new_tab,
       bg_color, text_color, button_color, button_text_color, border_radius, max_width,
       target_segment
FROM public.homepage_popup;

GRANT SELECT ON public.homepage_popup_public TO anon, authenticated;

-- Need a SELECT policy on base table for the security_invoker view to work for non-admins.
-- Restrict to admins only for direct access; the view above intentionally exposes safe columns.
-- We add a function-based policy that returns the popup row publicly EXCEPT we'll rely on the
-- view + a permissive policy that still hides target_user_ids by column-level revoke.
REVOKE SELECT (target_user_ids) ON public.homepage_popup FROM anon, authenticated;
CREATE POLICY "Homepage popup readable except targets"
  ON public.homepage_popup
  FOR SELECT
  USING (true);

-- 2) Tighten analytics_events INSERT (prevent spoofing user_id)
DROP POLICY IF EXISTS "Authenticated users can insert analytics" ON public.analytics_events;
CREATE POLICY "Authenticated users can insert analytics"
  ON public.analytics_events
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

-- 3) Remove feedback from Realtime publication if present (channel-level auth not configured)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'feedback'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.feedback';
  END IF;
END$$;
