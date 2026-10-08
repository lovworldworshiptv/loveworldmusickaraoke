ALTER TABLE public.onboarding_screens ADD COLUMN IF NOT EXISTS badge text;

CREATE OR REPLACE FUNCTION public.referrals_enabled() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT value::text <> 'false' FROM app_settings WHERE key = 'referrals_enabled'), true)
$$;

CREATE OR REPLACE FUNCTION public.claim_platform_referral(p_code text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_me uuid := auth.uid(); v_ref uuid; v_created timestamptz;
BEGIN
  IF NOT referrals_enabled() THEN RETURN false; END IF;
  IF v_me IS NULL OR p_code IS NULL OR length(trim(p_code)) = 0 THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM platform_referrals WHERE referred_user_id = v_me) THEN RETURN false; END IF;
  SELECT created_at INTO v_created FROM profiles WHERE user_id = v_me;
  IF v_created IS NULL OR v_created < now() - interval '3 days' THEN RETURN false; END IF;
  SELECT user_id INTO v_ref FROM profiles
   WHERE user_id::text = trim(p_code) OR lower(username) = lower(trim(p_code)) LIMIT 1;
  IF v_ref IS NULL OR v_ref = v_me THEN RETURN false; END IF;
  INSERT INTO platform_referrals(referred_user_id, referrer_user_id) VALUES (v_me, v_ref) ON CONFLICT DO NOTHING;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.request_subscription_with_credit(p_plan text, p_full_name text, p_kingschat text, p_proof_url text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_me uuid := auth.uid(); v_price numeric; v_bal numeric; v_credit numeric := 0; v_id uuid;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  v_price := plan_price(p_plan);
  IF v_price IS NULL THEN RAISE EXCEPTION 'Invalid plan'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('refbal:' || v_me::text));
  IF referrals_enabled() THEN
    v_bal := referral_balance(v_me);
    v_credit := LEAST(GREATEST(v_bal,0), v_price);
  END IF;
  IF v_credit < v_price AND (p_proof_url IS NULL OR length(p_proof_url) = 0) THEN
    RAISE EXCEPTION 'Proof of payment required for the remaining % ESPEES', v_price - v_credit;
  END IF;
  INSERT INTO subscription_requests(user_id, full_name, kingschat_username, plan, amount, proof_url, status)
  VALUES (v_me, p_full_name, p_kingschat, p_plan, v_price, NULLIF(p_proof_url,''), 'pending') RETURNING id INTO v_id;
  IF v_credit > 0 THEN
    INSERT INTO referral_credit_uses(request_id, user_id, amount) VALUES (v_id, v_me, v_credit);
    INSERT INTO referral_ledger(user_id, amount, kind, ref_id, note) VALUES (v_me, -v_credit, 'subscription', v_id, 'Applied to ' || p_plan);
  END IF;
  RETURN jsonb_build_object('request_id', v_id, 'credit_applied', v_credit, 'remaining', v_price - v_credit);
END $$;

CREATE OR REPLACE FUNCTION public.request_referral_payout(p_kingschat text) RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_me uuid := auth.uid(); v_bal numeric; v_id uuid;
BEGIN
  IF NOT referrals_enabled() THEN RAISE EXCEPTION 'Referrals are currently turned off'; END IF;
  IF v_me IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('refbal:' || v_me::text));
  v_bal := referral_balance(v_me);
  IF v_bal < 5 THEN RAISE EXCEPTION 'Payouts are available from 5 ESPEES'; END IF;
  INSERT INTO referral_payouts(user_id, amount, kingschat_username) VALUES (v_me, v_bal, p_kingschat) RETURNING id INTO v_id;
  INSERT INTO referral_ledger(user_id, amount, kind, ref_id, note) VALUES (v_me, -v_bal, 'payout', v_id, 'Payout request');
  RETURN v_bal;
END $$;

CREATE OR REPLACE FUNCTION public.handle_subscription_request_review() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ref uuid; v_credit numeric := 0; v_paid numeric;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  SELECT amount INTO v_credit FROM referral_credit_uses WHERE request_id = NEW.id;
  v_credit := COALESCE(v_credit, 0);
  IF NEW.status = 'approved' AND referrals_enabled() THEN
    SELECT referrer_user_id INTO v_ref FROM platform_referrals WHERE referred_user_id = NEW.user_id;
    v_paid := GREATEST(COALESCE(NEW.amount,0) - v_credit, 0);
    IF v_ref IS NOT NULL AND v_paid > 0 THEN
      INSERT INTO referral_ledger(user_id, amount, kind, ref_id, referred_user_id, note)
      VALUES (v_ref, round(v_paid * 0.10, 2), 'commission', NEW.id, NEW.user_id, '10% of ' || NEW.plan)
      ON CONFLICT DO NOTHING;
    END IF;
  ELSIF NEW.status = 'rejected' AND v_credit > 0
    AND NOT EXISTS (SELECT 1 FROM referral_ledger WHERE kind='refund' AND ref_id = NEW.id) THEN
    INSERT INTO referral_ledger(user_id, amount, kind, ref_id, note) VALUES (NEW.user_id, v_credit, 'refund', NEW.id, 'Subscription request rejected');
  END IF;
  RETURN NEW;
END $$;