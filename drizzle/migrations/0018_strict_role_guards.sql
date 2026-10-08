CREATE OR REPLACE FUNCTION public.guard_profile_privileged_cols() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT has_role(auth.uid(),'admin') THEN
    IF TG_OP = 'INSERT' THEN NEW.espees_balance := 0;
    ELSE NEW.espees_balance := OLD.espees_balance; NEW.user_id := OLD.user_id; END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_profile_privileged ON public.profiles;
CREATE TRIGGER trg_guard_profile_privileged BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileged_cols();

CREATE OR REPLACE FUNCTION public.guard_pending_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT has_role(auth.uid(),'admin') THEN
    NEW.status := 'pending';
    IF TG_TABLE_NAME = 'subscription_requests' THEN NEW.reviewed_by := NULL; NEW.reviewed_at := NULL; NEW.admin_notes := NULL;
    ELSIF TG_TABLE_NAME = 'gift_subscriptions' THEN NEW.reviewed_by := NULL; NEW.reviewed_at := NULL; NEW.admin_notes := NULL;
    ELSIF TG_TABLE_NAME = 'challenge_entries' THEN NEW.approved_by := NULL; NEW.approved_at := NULL; NEW.admin_notes := NULL;
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

CREATE OR REPLACE FUNCTION public.guard_editor_song_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT has_role(auth.uid(),'admin') THEN
    IF (to_jsonb(NEW) - 'lyrics_lrc' - 'lyrics_text') IS DISTINCT FROM (to_jsonb(OLD) - 'lyrics_lrc' - 'lyrics_text') THEN
      RAISE EXCEPTION 'Editors may only change lyrics';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_editor_song ON public.songs;
CREATE TRIGGER trg_guard_editor_song BEFORE UPDATE ON public.songs FOR EACH ROW EXECUTE FUNCTION public.guard_editor_song_update();