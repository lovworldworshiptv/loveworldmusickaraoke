CREATE POLICY "Admins remove community members" ON public.community_members FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.get_community_members_admin(p_community_id uuid)
RETURNS TABLE(user_id uuid, username text, avatar_url text, joined_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  RETURN QUERY SELECT m.user_id, COALESCE(p.username, 'User'), p.avatar_url, m.joined_at
  FROM public.community_members m LEFT JOIN public.profiles p ON p.user_id = m.user_id
  WHERE m.community_id = p_community_id ORDER BY m.joined_at DESC;
END $$;
REVOKE ALL ON FUNCTION public.get_community_members_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_community_members_admin(uuid) TO authenticated;