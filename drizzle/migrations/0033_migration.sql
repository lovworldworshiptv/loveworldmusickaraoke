CREATE OR REPLACE FUNCTION public.resolve_invite_code(p_code text)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_code text := trim(coalesce(p_code, '')); v_id uuid; v_count int;
BEGIN
  IF length(v_code) = 0 THEN RETURN NULL; END IF;
  IF v_code ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT user_id INTO v_id FROM profiles WHERE user_id = v_code::uuid;
    RETURN v_id;
  END IF;
  SELECT count(*), min(user_id::text)::uuid INTO v_count, v_id FROM profiles WHERE lower(username) = lower(v_code);
  IF v_count = 1 THEN RETURN v_id; END IF;
  RETURN NULL; -- unknown or shared name: never guess the referrer
END $$;
REVOKE ALL ON FUNCTION public.resolve_invite_code(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.invite_referrer_name(p_code text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE WHEN referrals_enabled() THEN (SELECT username FROM profiles WHERE user_id = resolve_invite_code(p_code)) END
$$;
GRANT EXECUTE ON FUNCTION public.invite_referrer_name(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_platform_referral(p_code text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_me uuid := auth.uid(); v_ref uuid; v_created timestamptz;
BEGIN
  IF NOT referrals_enabled() THEN RETURN false; END IF;
  IF v_me IS NULL OR p_code IS NULL OR length(trim(p_code)) = 0 THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM platform_referrals WHERE referred_user_id = v_me) THEN RETURN false; END IF;
  SELECT created_at INTO v_created FROM profiles WHERE user_id = v_me;
  IF v_created IS NULL OR v_created < now() - interval '3 days' THEN RETURN false; END IF;
  v_ref := resolve_invite_code(p_code);
  IF v_ref IS NULL OR v_ref = v_me THEN RETURN false; END IF;
  INSERT INTO platform_referrals(referred_user_id, referrer_user_id) VALUES (v_me, v_ref) ON CONFLICT DO NOTHING;
  RETURN true;
END $function$;