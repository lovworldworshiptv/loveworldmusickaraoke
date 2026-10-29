CREATE TABLE public.user_activity_days (
  user_id uuid NOT NULL,
  day date NOT NULL,
  country_code text,
  source text NOT NULL DEFAULT 'unknown',
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day),
  CONSTRAINT user_activity_days_country_chk CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$'),
  CONSTRAINT user_activity_days_source_chk CHECK (source IN ('network','timezone','unknown'))
);

GRANT SELECT ON public.user_activity_days TO authenticated;
GRANT ALL ON public.user_activity_days TO service_role;

ALTER TABLE public.user_activity_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read activity days" ON public.user_activity_days
  FOR SELECT TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)));

CREATE INDEX user_activity_days_day_idx ON public.user_activity_days (day);

-- One row per signed-in person per day; the country is only improved, never blanked.
CREATE OR REPLACE FUNCTION public.log_activity_day(p_country text, p_source text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_cc text := upper(nullif(trim(p_country), ''));
  v_src text := CASE WHEN p_source IN ('network','timezone') THEN p_source ELSE 'unknown' END;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  IF v_cc IS NOT NULL AND (v_cc !~ '^[A-Z]{2}$' OR v_cc IN ('XX','T1','ZZ')) THEN v_cc := NULL; END IF;
  IF v_cc IS NULL THEN v_src := 'unknown'; END IF;
  INSERT INTO public.user_activity_days (user_id, day, country_code, source)
  VALUES (v_uid, (now() AT TIME ZONE 'UTC')::date, v_cc, v_src)
  ON CONFLICT (user_id, day) DO UPDATE
    SET country_code = EXCLUDED.country_code, source = EXCLUDED.source
    WHERE EXCLUDED.country_code IS NOT NULL
      AND (user_activity_days.country_code IS NULL
           OR (user_activity_days.source = 'timezone' AND EXCLUDED.source = 'network'));
END;
$function$;

REVOKE ALL ON FUNCTION public.log_activity_day(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_activity_day(text, text) TO authenticated;

-- Countries people used the app from in the last p_days days (null = all time).
CREATE OR REPLACE FUNCTION public.admin_country_stats(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_from date := CASE WHEN p_days IS NULL OR p_days <= 0 THEN '-infinity'::date
                      ELSE (now() AT TIME ZONE 'UTC')::date - (p_days - 1) END;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  RETURN (
    WITH r AS (SELECT * FROM public.user_activity_days WHERE day >= v_from),
    -- each person's most frequent country in the window (ties: latest day)
    per_user AS (
      SELECT DISTINCT ON (user_id) user_id, country_code
      FROM (SELECT user_id, country_code, count(*) n, max(day) last_day FROM r WHERE country_code IS NOT NULL GROUP BY 1,2) x
      ORDER BY user_id, n DESC, last_day DESC
    )
    SELECT jsonb_build_object(
      'tracked_since', (SELECT min(day) FROM public.user_activity_days),
      'active_users', (SELECT count(DISTINCT user_id) FROM r),
      'located_users', (SELECT count(*) FROM per_user),
      'unknown_users', (SELECT count(DISTINCT user_id) FROM r) - (SELECT count(*) FROM per_user),
      'countries_count', (SELECT count(DISTINCT country_code) FROM per_user),
      'by_network', (SELECT count(DISTINCT user_id) FROM r WHERE source = 'network'),
      'by_timezone', (SELECT count(DISTINCT user_id) FROM r WHERE source = 'timezone'
                        AND user_id NOT IN (SELECT user_id FROM r WHERE source = 'network')),
      'countries', coalesce((SELECT jsonb_agg(row_to_json(t) ORDER BY t.users DESC, t.code) FROM (
          SELECT p.country_code AS code, count(*) AS users,
            (SELECT count(*) FROM r WHERE r.country_code = p.country_code) AS active_days
          FROM per_user p GROUP BY p.country_code) t), '[]'::jsonb)
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_country_stats(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_country_stats(integer) TO authenticated;