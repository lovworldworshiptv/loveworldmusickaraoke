-- Indexes for the hottest per-user and per-song lookups
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_created ON public.user_notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_song_videos_song_active ON public.song_videos (song_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_game_sessions_user ON public.game_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_songs_category ON public.songs (category_id);
CREATE INDEX IF NOT EXISTS idx_songs_album ON public.songs (album_id);
CREATE INDEX IF NOT EXISTS idx_playlist_songs_song ON public.playlist_songs (song_id);

-- Evaluate auth.uid() and role checks once per query instead of once per row.
-- Same rules, same results; only the evaluation plan changes.
DO $$
DECLARE p record; q text; c text; stmt text;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies WHERE schemaname = 'public'
  LOOP
    q := p.qual; c := p.with_check;
    CONTINUE WHEN coalesce(q,'') || coalesce(c,'') !~ 'auth\.uid\(\)';
    CONTINUE WHEN coalesce(q,'') || coalesce(c,'') ~ 'SELECT auth\.uid\(\)';
    q := regexp_replace(q, 'auth\.uid\(\)', '(SELECT auth.uid())', 'g');
    c := regexp_replace(c, 'auth\.uid\(\)', '(SELECT auth.uid())', 'g');
    q := regexp_replace(q, 'has_role\(\(SELECT auth\.uid\(\)\), (''[a-z_]+''::app_role)\)', '(SELECT has_role((SELECT auth.uid()), \1))', 'g');
    c := regexp_replace(c, 'has_role\(\(SELECT auth\.uid\(\)\), (''[a-z_]+''::app_role)\)', '(SELECT has_role((SELECT auth.uid()), \1))', 'g');
    stmt := format('ALTER POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
    IF q IS NOT NULL THEN stmt := stmt || ' USING (' || q || ')'; END IF;
    IF c IS NOT NULL THEN stmt := stmt || ' WITH CHECK (' || c || ')'; END IF;
    EXECUTE stmt;
  END LOOP;
END $$;