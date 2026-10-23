-- Users cannot change their own Espees balance or move their profile to another account.
CREATE OR REPLACE FUNCTION public.guard_profile_privileged_cols() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(),'admin') THEN
    IF TG_OP = 'INSERT' THEN NEW.espees_balance := 0;
    ELSE NEW.espees_balance := OLD.espees_balance; NEW.user_id := OLD.user_id; END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_profile_privileged ON public.profiles;
CREATE TRIGGER trg_guard_profile_privileged BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileged_cols();

-- Requests submitted by users always start as pending with no review fields.
CREATE OR REPLACE FUNCTION public.guard_pending_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(),'admin') THEN
    NEW.status := 'pending';
    IF TG_TABLE_NAME IN ('subscription_requests','gift_subscriptions') THEN
      NEW.reviewed_by := NULL; NEW.reviewed_at := NULL; NEW.admin_notes := NULL;
    ELSIF TG_TABLE_NAME = 'challenge_entries' THEN
      NEW.approved_by := NULL; NEW.approved_at := NULL; NEW.admin_notes := NULL;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_pending ON public.subscription_requests;
CREATE TRIGGER trg_guard_pending BEFORE INSERT ON public.subscription_requests FOR EACH ROW EXECUTE FUNCTION public.guard_pending_insert();
DROP TRIGGER IF EXISTS trg_guard_pending ON public.gift_subscriptions;
CREATE TRIGGER trg_guard_pending BEFORE INSERT ON public.gift_subscriptions FOR EACH ROW EXECUTE FUNCTION public.guard_pending_insert();
DROP TRIGGER IF EXISTS trg_guard_pending ON public.challenge_entries;
CREATE TRIGGER trg_guard_pending BEFORE INSERT ON public.challenge_entries FOR EACH ROW EXECUTE FUNCTION public.guard_pending_insert();

-- Song edits: admins and backend jobs unrestricted; editors may edit song details
-- but not a song's identity; any other signed-in path (e.g. play counting) may only move counters.
CREATE OR REPLACE FUNCTION public.guard_editor_song_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE counters text[] := ARRAY['play_count','total_sung','search_tsv'];
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(),'admin') THEN RETURN NEW; END IF;
  IF public.has_role(auth.uid(),'editor') THEN
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Editors cannot change a song''s identity';
    END IF;
    RETURN NEW;
  END IF;
  IF (to_jsonb(NEW) - counters) IS DISTINCT FROM (to_jsonb(OLD) - counters) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_editor_song ON public.songs;
CREATE TRIGGER trg_guard_editor_song BEFORE UPDATE ON public.songs FOR EACH ROW EXECUTE FUNCTION public.guard_editor_song_update();