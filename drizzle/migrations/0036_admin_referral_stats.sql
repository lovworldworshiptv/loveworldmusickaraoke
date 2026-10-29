CREATE OR REPLACE FUNCTION public.admin_referral_stats(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cutoff timestamptz := CASE WHEN p_days IS NULL OR p_days <= 0 THEN '-infinity'::timestamptz ELSE now() - make_interval(days => p_days) END;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  RETURN (SELECT jsonb_build_object(
    'credited_in_range', count(*) FILTER (WHERE created_at >= v_cutoff),
    'credited_total', count(*),
    'inviters_in_range', count(DISTINCT referrer_user_id) FILTER (WHERE created_at >= v_cutoff))
  FROM public.platform_referrals);
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_referral_stats(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_referral_stats(integer) TO authenticated;