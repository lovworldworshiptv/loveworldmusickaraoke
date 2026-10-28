ALTER TABLE public.user_subscriptions ADD COLUMN IF NOT EXISTS trial_used_at timestamptz;

-- Backfill: anyone on a trial now, or whose last period was the 3-day trial window
UPDATE public.user_subscriptions
SET trial_used_at = COALESCE(subscription_start_date, updated_at, now())
WHERE trial_used_at IS NULL
  AND (
    subscription = 'trial'
    OR subscription_plan = '3_day_trial'
    OR (subscription_start_date IS NOT NULL AND subscription_expiry_date IS NOT NULL
        AND subscription_expiry_date - subscription_start_date BETWEEN interval '71 hours' AND interval '73 hours')
  );

CREATE OR REPLACE FUNCTION public.mark_trial_used()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.trial_used_at IS NOT NULL THEN
    NEW.trial_used_at := OLD.trial_used_at; -- once used, always used
  END IF;
  IF NEW.subscription = 'trial' AND NEW.trial_used_at IS NULL THEN
    NEW.trial_used_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_trial_used ON public.user_subscriptions;
CREATE TRIGGER trg_mark_trial_used
BEFORE INSERT OR UPDATE ON public.user_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.mark_trial_used();

COMMENT ON COLUMN public.user_subscriptions.trial_used_at IS 'When the one-time free trial was first used; never cleared';