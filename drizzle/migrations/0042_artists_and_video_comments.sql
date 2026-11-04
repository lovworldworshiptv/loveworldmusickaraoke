CREATE TABLE public.artists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL UNIQUE,
  image_url text,
  cover_url text,
  description text,
  is_verified boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.artists TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.artists TO authenticated;
GRANT ALL ON public.artists TO service_role;
ALTER TABLE public.artists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Artists readable" ON public.artists FOR SELECT USING (true);
CREATE POLICY "Admins manage artists" ON public.artists FOR ALL TO authenticated
  USING ((SELECT public.has_role(auth.uid(),'admin'))) WITH CHECK ((SELECT public.has_role(auth.uid(),'admin')));
CREATE TRIGGER artists_updated BEFORE UPDATE ON public.artists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.artists (name, slug, description) VALUES ('Loveworld Singers','loveworld-singers','The worship choir of Loveworld, leading the nations in praise.');

CREATE TABLE public.artist_follows (
  user_id uuid NOT NULL,
  artist_id uuid NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, artist_id)
);
GRANT SELECT ON public.artist_follows TO anon;
GRANT SELECT, INSERT, DELETE ON public.artist_follows TO authenticated;
GRANT ALL ON public.artist_follows TO service_role;
ALTER TABLE public.artist_follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Follows readable" ON public.artist_follows FOR SELECT USING (true);
CREATE POLICY "Follow self" ON public.artist_follows FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Unfollow self" ON public.artist_follows FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

CREATE TABLE public.video_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_video_id uuid NOT NULL REFERENCES public.song_videos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  parent_id uuid REFERENCES public.video_comments(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 1000),
  like_count int NOT NULL DEFAULT 0,
  reply_count int NOT NULL DEFAULT 0,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX video_comments_video_idx ON public.video_comments (song_video_id, created_at DESC);
CREATE INDEX video_comments_parent_idx ON public.video_comments (parent_id);
CREATE INDEX video_comments_user_idx ON public.video_comments (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_comments TO authenticated;
GRANT ALL ON public.video_comments TO service_role;
ALTER TABLE public.video_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read comments" ON public.video_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Post as self" ON public.video_comments FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()) AND is_deleted = false AND like_count = 0 AND reply_count = 0);
CREATE POLICY "Edit own" ON public.video_comments FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid()) OR (SELECT public.has_role(auth.uid(),'admin')));
CREATE POLICY "Delete own or admin" ON public.video_comments FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()) OR (SELECT public.has_role(auth.uid(),'admin')));

CREATE OR REPLACE FUNCTION public.video_comments_before_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record;
BEGIN
  IF auth.uid() IS NOT NULL AND (SELECT count(*) FROM video_comments WHERE user_id = NEW.user_id AND created_at > now() - interval '1 minute') >= 5 THEN
    RAISE EXCEPTION 'You are commenting too fast. Please wait a minute.';
  END IF;
  IF NEW.parent_id IS NOT NULL THEN
    SELECT parent_id, song_video_id INTO p FROM video_comments WHERE id = NEW.parent_id;
    IF p.parent_id IS NOT NULL THEN RAISE EXCEPTION 'Replies can only be one level deep'; END IF;
    NEW.song_video_id := p.song_video_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER video_comments_bi BEFORE INSERT ON public.video_comments FOR EACH ROW EXECUTE FUNCTION public.video_comments_before_insert();

-- Users may only change body/is_deleted on own rows; counters are kept by triggers.
CREATE OR REPLACE FUNCTION public.video_comments_guard_update() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND current_setting('lw.counter', true) IS DISTINCT FROM '1' THEN
    NEW.like_count := OLD.like_count; NEW.reply_count := OLD.reply_count;
    NEW.user_id := OLD.user_id; NEW.song_video_id := OLD.song_video_id; NEW.parent_id := OLD.parent_id;
    NEW.created_at := OLD.created_at;
    IF OLD.user_id <> auth.uid() THEN NEW.body := OLD.body; END IF;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER video_comments_bu BEFORE UPDATE ON public.video_comments FOR EACH ROW EXECUTE FUNCTION public.video_comments_guard_update();

CREATE OR REPLACE FUNCTION public.video_comments_reply_count() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM set_config('lw.counter','1',true);
  IF TG_OP = 'INSERT' AND NEW.parent_id IS NOT NULL THEN
    UPDATE video_comments SET reply_count = reply_count + 1 WHERE id = NEW.parent_id;
  ELSIF TG_OP = 'DELETE' AND OLD.parent_id IS NOT NULL THEN
    UPDATE video_comments SET reply_count = greatest(reply_count - 1, 0) WHERE id = OLD.parent_id;
  END IF;
  PERFORM set_config('lw.counter','0',true);
  RETURN NULL;
END $$;
CREATE TRIGGER video_comments_ai AFTER INSERT OR DELETE ON public.video_comments FOR EACH ROW EXECUTE FUNCTION public.video_comments_reply_count();

CREATE TABLE public.video_comment_likes (
  user_id uuid NOT NULL,
  comment_id uuid NOT NULL REFERENCES public.video_comments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, comment_id)
);
GRANT SELECT, INSERT, DELETE ON public.video_comment_likes TO authenticated;
GRANT ALL ON public.video_comment_likes TO service_role;
ALTER TABLE public.video_comment_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own likes" ON public.video_comment_likes FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Like self" ON public.video_comment_likes FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Unlike self" ON public.video_comment_likes FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.video_comment_likes_count() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM set_config('lw.counter','1',true);
  IF TG_OP = 'INSERT' THEN UPDATE video_comments SET like_count = like_count + 1 WHERE id = NEW.comment_id;
  ELSE UPDATE video_comments SET like_count = greatest(like_count - 1, 0) WHERE id = OLD.comment_id; END IF;
  PERFORM set_config('lw.counter','0',true);
  RETURN NULL;
END $$;
CREATE TRIGGER video_comment_likes_ai AFTER INSERT OR DELETE ON public.video_comment_likes FOR EACH ROW EXECUTE FUNCTION public.video_comment_likes_count();

CREATE OR REPLACE FUNCTION public.get_artist_stats(p_artist_id uuid)
RETURNS TABLE(songs bigint, karaoke bigint, videos bigint, followers bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH a AS (SELECT lower(name) n FROM artists WHERE id = p_artist_id),
  s AS (
    SELECT so.id, so.instrumental_url FROM songs so, a
    WHERE EXISTS (
      SELECT 1 FROM regexp_split_to_table(so.artist, '\s*(,|&|\mfeat\.?|\mft\.?)\s*', 'i') part
      WHERE lower(trim(part)) = a.n)
  )
  SELECT (SELECT count(*) FROM s),
         (SELECT count(*) FROM s WHERE instrumental_url IS NOT NULL),
         (SELECT count(*) FROM song_videos v JOIN s ON s.id = v.song_id WHERE v.is_active),
         (SELECT count(*) FROM artist_follows WHERE artist_id = p_artist_id);
$$;
GRANT EXECUTE ON FUNCTION public.get_artist_stats(uuid) TO anon, authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.video_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.video_comment_likes;