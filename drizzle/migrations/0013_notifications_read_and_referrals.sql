CREATE POLICY "Users read their delivered notifications" ON public.notifications FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_notifications un WHERE un.notification_id = notifications.id AND un.user_id = auth.uid()));
GRANT SELECT ON public.notifications TO authenticated;

CREATE TABLE public.platform_referrals (
  referred_user_id uuid PRIMARY KEY,
  referrer_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (referred_user_id <> referrer_user_id)
);
GRANT SELECT ON public.platform_referrals TO authenticated;
GRANT ALL ON public.platform_referrals TO service_role;
ALTER TABLE public.platform_referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own referrals" ON public.platform_referrals FOR SELECT TO authenticated
USING (referrer_user_id = auth.uid() OR referred_user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE INDEX ON public.platform_referrals(referrer_user_id);

CREATE TABLE public.referral_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric(12,2) NOT NULL,
  kind text NOT NULL CHECK (kind IN ('commission','payout','subscription','refund')),
  ref_id uuid,
  referred_user_id uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX referral_ledger_commission_once ON public.referral_ledger(ref_id) WHERE kind = 'commission';
CREATE INDEX ON public.referral_ledger(user_id);
GRANT SELECT ON public.referral_ledger TO authenticated;
GRANT ALL ON public.referral_ledger TO service_role;
ALTER TABLE public.referral_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ledger" ON public.referral_ledger FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.referral_credit_uses (
  request_id uuid PRIMARY KEY REFERENCES public.subscription_requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  amount numeric(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.referral_credit_uses TO authenticated;
GRANT ALL ON public.referral_credit_uses TO service_role;
ALTER TABLE public.referral_credit_uses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own credit uses" ON public.referral_credit_uses FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.referral_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric(12,2) NOT NULL,
  kingschat_username text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','rejected')),
  admin_notes text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.referral_payouts TO authenticated;
GRANT ALL ON public.referral_payouts TO service_role;
ALTER TABLE public.referral_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own payouts" ON public.referral_payouts FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.referral_balance(_user_id uuid) RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(amount),0) FROM public.referral_ledger WHERE user_id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.claim_platform_referral(p_code text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_me uuid := auth.uid(); v_ref uuid; v_created timestamptz;
BEGIN
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

CREATE OR REPLACE FUNCTION public.get_my_referral_dashboard()
RETURNS TABLE(username text, joined_at timestamptz, is_premium_payer boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.username, r.created_at,
    EXISTS (SELECT 1 FROM referral_ledger l WHERE l.user_id = auth.uid() AND l.kind='commission' AND l.referred_user_id = r.referred_user_id)
  FROM platform_referrals r JOIN profiles p ON p.user_id = r.referred_user_id
  WHERE r.referrer_user_id = auth.uid()
  ORDER BY r.created_at DESC
$$;

CREATE OR REPLACE FUNCTION public.plan_price(p_plan text) RETURNS numeric
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_plan WHEN '1_month' THEN 2 WHEN '6_months' THEN 10 WHEN '1_year' THEN 15 ELSE NULL END::numeric
$$;

CREATE OR REPLACE FUNCTION public.request_subscription_with_credit(p_plan text, p_full_name text, p_kingschat text, p_proof_url text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_me uuid := auth.uid(); v_price numeric; v_bal numeric; v_credit numeric; v_id uuid;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  v_price := plan_price(p_plan);
  IF v_price IS NULL THEN RAISE EXCEPTION 'Invalid plan'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('refbal:' || v_me::text));
  v_bal := referral_balance(v_me);
  v_credit := LEAST(GREATEST(v_bal,0), v_price);
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
  IF v_me IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('refbal:' || v_me::text));
  v_bal := referral_balance(v_me);
  IF v_bal < 5 THEN RAISE EXCEPTION 'Payouts are available from 5 ESPEES'; END IF;
  INSERT INTO referral_payouts(user_id, amount, kingschat_username) VALUES (v_me, v_bal, p_kingschat) RETURNING id INTO v_id;
  INSERT INTO referral_ledger(user_id, amount, kind, ref_id, note) VALUES (v_me, -v_bal, 'payout', v_id, 'Payout request');
  RETURN v_bal;
END $$;

CREATE OR REPLACE FUNCTION public.review_referral_payout(p_id uuid, p_status text, p_notes text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row referral_payouts;
BEGIN
  IF NOT has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF p_status NOT IN ('paid','rejected') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  SELECT * INTO v_row FROM referral_payouts WHERE id = p_id FOR UPDATE;
  IF v_row.id IS NULL OR v_row.status <> 'pending' THEN RAISE EXCEPTION 'Payout already reviewed'; END IF;
  UPDATE referral_payouts SET status = p_status, admin_notes = p_notes, reviewed_at = now() WHERE id = p_id;
  IF p_status = 'rejected' THEN
    INSERT INTO referral_ledger(user_id, amount, kind, ref_id, note) VALUES (v_row.user_id, v_row.amount, 'refund', p_id, 'Payout rejected');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.handle_subscription_request_review() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ref uuid; v_credit numeric := 0; v_paid numeric;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  SELECT amount INTO v_credit FROM referral_credit_uses WHERE request_id = NEW.id;
  v_credit := COALESCE(v_credit, 0);
  IF NEW.status = 'approved' THEN
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
CREATE TRIGGER subscription_request_referral_review AFTER UPDATE OF status ON public.subscription_requests
FOR EACH ROW EXECUTE FUNCTION public.handle_subscription_request_review();

REVOKE EXECUTE ON FUNCTION public.referral_balance(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_platform_referral(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_referral_dashboard() FROM anon;
REVOKE EXECUTE ON FUNCTION public.request_subscription_with_credit(text,text,text,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.request_referral_payout(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.review_referral_payout(uuid,text,text) FROM anon;