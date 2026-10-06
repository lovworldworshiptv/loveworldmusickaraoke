CREATE TABLE public.community_moderators (
 community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
 user_id uuid NOT NULL,
 appointed_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (community_id, user_id)
);
GRANT SELECT ON public.community_moderators TO authenticated;
GRANT ALL ON public.community_moderators TO service_role;
ALTER TABLE public.community_moderators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own moderator assignments or admin" ON public.community_moderators FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE FUNCTION public.can_moderate_community(p_community_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT public.has_role(auth.uid(), 'admin') OR EXISTS (SELECT 1 FROM public.community_moderators cm JOIN public.community_members m ON m.community_id=cm.community_id AND m.user_id=cm.user_id WHERE cm.community_id=p_community_id AND cm.user_id=auth.uid());
$$;
REVOKE ALL ON FUNCTION public.can_moderate_community(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_moderate_community(uuid) TO authenticated;
CREATE POLICY "Community moderators delete posts" ON public.community_posts FOR DELETE TO authenticated USING (public.can_moderate_community(community_id));
CREATE POLICY "Community moderators delete comments" ON public.community_post_comments FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.community_posts p WHERE p.id=post_id AND public.can_moderate_community(p.community_id)));
CREATE FUNCTION public.set_community_moderator(p_community_id uuid, p_user_id uuid, p_enabled boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id=p_user_id) THEN RAISE EXCEPTION 'User not found'; END IF;
 IF p_enabled THEN
  INSERT INTO public.community_members (community_id,user_id) VALUES (p_community_id,p_user_id) ON CONFLICT (community_id,user_id) DO NOTHING;
  INSERT INTO public.community_moderators (community_id,user_id,appointed_by) VALUES (p_community_id,p_user_id,auth.uid()) ON CONFLICT (community_id,user_id) DO NOTHING;
 ELSE
  DELETE FROM public.community_moderators WHERE community_id=p_community_id AND user_id=p_user_id;
 END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.set_community_moderator(uuid,uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_community_moderator(uuid,uuid,boolean) TO authenticated;
CREATE FUNCTION public.search_community_moderators(p_community_id uuid, p_query text DEFAULT '') RETURNS TABLE(user_id uuid, username text, avatar_url text, is_moderator boolean) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT p.user_id,p.username,p.avatar_url,cm.user_id IS NOT NULL FROM public.profiles p LEFT JOIN public.community_moderators cm ON cm.user_id=p.user_id AND cm.community_id=p_community_id WHERE (length(trim(p_query)) >= 2 AND p.username ILIKE '%' || replace(replace(replace(trim(p_query),'\','\\'),'%','\%'),'_','\_') || '%') OR (trim(p_query)='' AND cm.user_id IS NOT NULL) ORDER BY (cm.user_id IS NOT NULL) DESC,p.username LIMIT 30;
END;
$$;
REVOKE ALL ON FUNCTION public.search_community_moderators(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_community_moderators(uuid,text) TO authenticated;