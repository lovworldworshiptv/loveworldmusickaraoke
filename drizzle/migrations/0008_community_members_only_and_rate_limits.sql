CREATE OR REPLACE FUNCTION public.is_community_member(_community_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.community_members WHERE community_id = _community_id AND user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.can_view_community_post(_post_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.community_posts p
    JOIN public.community_members m ON m.community_id = p.community_id AND m.user_id = _user_id
    WHERE p.id = _post_id)
$$;

CREATE OR REPLACE FUNCTION public.get_community_member_counts()
RETURNS TABLE(community_id uuid, member_count bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.community_id, COUNT(*) FROM public.community_members m
  JOIN public.communities c ON c.id = m.community_id AND c.is_active
  GROUP BY m.community_id
$$;
REVOKE EXECUTE ON FUNCTION public.get_community_member_counts() FROM anon;

DROP POLICY IF EXISTS "Members list visible" ON public.community_members;
CREATE POLICY "Members see co-members" ON public.community_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_community_member(community_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Posts readable by authenticated" ON public.community_posts;
CREATE POLICY "Members read posts" ON public.community_posts FOR SELECT TO authenticated
  USING (public.is_community_member(community_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Likes readable" ON public.community_post_likes;
CREATE POLICY "Members read likes" ON public.community_post_likes FOR SELECT TO authenticated
  USING (public.can_view_community_post(post_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Comments readable" ON public.community_post_comments;
CREATE POLICY "Members read comments" ON public.community_post_comments FOR SELECT TO authenticated
  USING (public.can_view_community_post(post_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users like posts" ON public.community_post_likes;
CREATE POLICY "Members like posts" ON public.community_post_likes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_view_community_post(post_id, auth.uid()));
DROP POLICY IF EXISTS "Users comment" ON public.community_post_comments;
CREATE POLICY "Members comment" ON public.community_post_comments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_view_community_post(post_id, auth.uid()));

-- Ad-hoc per-user rate limits (stopgap until platform rate limiting exists)
CREATE OR REPLACE FUNCTION public.enforce_community_rate_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n int; _max int;
BEGIN
  IF public.has_role(NEW.user_id, 'admin') THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'community_posts' THEN
    _max := 5;  SELECT count(*) INTO _n FROM public.community_posts WHERE user_id = NEW.user_id AND created_at > now() - interval '1 minute';
  ELSIF TG_TABLE_NAME = 'community_post_comments' THEN
    _max := 10; SELECT count(*) INTO _n FROM public.community_post_comments WHERE user_id = NEW.user_id AND created_at > now() - interval '1 minute';
  ELSE
    _max := 30; SELECT count(*) INTO _n FROM public.community_post_likes WHERE user_id = NEW.user_id AND created_at > now() - interval '1 minute';
  END IF;
  IF _n >= _max THEN
    RAISE EXCEPTION 'rate_limited: please slow down and try again in a minute' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_rate_limit_posts BEFORE INSERT ON public.community_posts FOR EACH ROW EXECUTE FUNCTION public.enforce_community_rate_limit();
CREATE TRIGGER trg_rate_limit_comments BEFORE INSERT ON public.community_post_comments FOR EACH ROW EXECUTE FUNCTION public.enforce_community_rate_limit();
CREATE TRIGGER trg_rate_limit_likes BEFORE INSERT ON public.community_post_likes FOR EACH ROW EXECUTE FUNCTION public.enforce_community_rate_limit();