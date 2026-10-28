CREATE OR REPLACE FUNCTION public.mark_trial_used()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.trial_used_at IS NOT NULL THEN
    NEW.trial_used_at := OLD.trial_used_at; -- once used, always used
    -- A used trial can never be started again or extended, by anyone.
    IF NEW.subscription = 'trial'
       AND (OLD.subscription IS DISTINCT FROM 'trial'
            OR NEW.subscription_expiry_date IS DISTINCT FROM OLD.subscription_expiry_date) THEN
      RAISE EXCEPTION 'TRIAL_ALREADY_USED: the free trial can only be used once'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  IF NEW.subscription = 'trial' AND NEW.trial_used_at IS NULL THEN
    NEW.trial_used_at := now();
  END IF;
  RETURN NEW;
END;
$function$;