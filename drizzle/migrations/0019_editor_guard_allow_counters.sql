CREATE OR REPLACE FUNCTION public.guard_editor_song_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ign text[] := ARRAY['lyrics_lrc','lyrics_text','play_count','total_sung'];
BEGIN
  IF auth.uid() IS NOT NULL AND NOT has_role(auth.uid(),'admin') THEN
    IF (to_jsonb(NEW) - ign) IS DISTINCT FROM (to_jsonb(OLD) - ign) THEN
      RAISE EXCEPTION 'Editors may only change lyrics';
    END IF;
    IF NOT has_role(auth.uid(),'editor') AND (NEW.lyrics_lrc IS DISTINCT FROM OLD.lyrics_lrc OR NEW.lyrics_text IS DISTINCT FROM OLD.lyrics_text) THEN
      RAISE EXCEPTION 'Not allowed';
    END IF;
  END IF;
  RETURN NEW;
END $$;