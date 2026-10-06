-- Signed-in regression test for community privacy + rate limits.
-- Runs entirely in one block and always rolls back (ends with RAISE 'ALL_PASSED').
DO $$
DECLARE
  _admin uuid; _member uuid; _outsider uuid; _c uuid; _p uuid; _n int; _i int; _ok boolean;
  _posts uuid[] := '{}';
BEGIN
  SELECT user_id INTO _admin FROM public.user_roles WHERE role='admin' LIMIT 1;
  SELECT u.user_id INTO _member FROM public.profiles u WHERE NOT public.has_role(u.user_id,'admin') ORDER BY u.created_at LIMIT 1;
  SELECT u.user_id INTO _outsider FROM public.profiles u WHERE NOT public.has_role(u.user_id,'admin') AND u.user_id <> _member ORDER BY u.created_at LIMIT 1;
  IF _admin IS NULL OR _member IS NULL OR _outsider IS NULL THEN RAISE EXCEPTION 'SETUP: need 1 admin + 2 regular users'; END IF;

  INSERT INTO public.communities(name, is_active) VALUES ('__test__', true) RETURNING id INTO _c;
  INSERT INTO public.community_members(community_id, user_id) VALUES (_c,_member),(_c,_admin);
  INSERT INTO public.community_posts(community_id,user_id,content) VALUES (_c,_admin,'seed') RETURNING id INTO _p;
  INSERT INTO public.community_post_comments(post_id,user_id,content) VALUES (_p,_admin,'seed');
  INSERT INTO public.community_post_likes(post_id,user_id) VALUES (_p,_admin);
  FOR _i IN 1..31 LOOP
    INSERT INTO public.community_posts(community_id,user_id,content) VALUES (_c,_admin,'like-target') RETURNING id INTO _p;
    _posts := _posts || _p;
  END LOOP;

  -- 1. Non-member sees nothing
  PERFORM set_config('request.jwt.claims', json_build_object('sub',_outsider,'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO _n FROM public.community_posts WHERE community_id=_c; IF _n<>0 THEN RAISE EXCEPTION 'FAIL: outsider sees % posts',_n; END IF;
  SELECT count(*) INTO _n FROM public.community_members WHERE community_id=_c; IF _n<>0 THEN RAISE EXCEPTION 'FAIL: outsider sees members'; END IF;
  SELECT count(*) INTO _n FROM public.community_post_comments c WHERE c.post_id = ANY(_posts) OR c.content='seed'; IF _n<>0 THEN RAISE EXCEPTION 'FAIL: outsider sees comments'; END IF;
  SELECT count(*) INTO _n FROM public.community_post_likes l JOIN public.community_posts p ON p.id=l.post_id WHERE p.community_id=_c; IF _n<>0 THEN RAISE EXCEPTION 'FAIL: outsider sees likes'; END IF;
  _ok := false; BEGIN INSERT INTO public.community_posts(community_id,user_id,content) VALUES (_c,_outsider,'x'); EXCEPTION WHEN OTHERS THEN _ok := true; END;
  IF NOT _ok THEN RAISE EXCEPTION 'FAIL: outsider could post'; END IF;
  RESET ROLE;

  -- 2. Regular member: 5 posts, 10 comments, 30 likes per minute
  PERFORM set_config('request.jwt.claims', json_build_object('sub',_member,'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO _n FROM public.community_posts WHERE community_id=_c; IF _n=0 THEN RAISE EXCEPTION 'FAIL: member cannot see posts'; END IF;
  FOR _i IN 1..5 LOOP INSERT INTO public.community_posts(community_id,user_id,content) VALUES (_c,_member,'p'); END LOOP;
  _ok := false; BEGIN INSERT INTO public.community_posts(community_id,user_id,content) VALUES (_c,_member,'p6'); EXCEPTION WHEN OTHERS THEN _ok := SQLERRM LIKE 'rate_limited%'; END;
  IF NOT _ok THEN RAISE EXCEPTION 'FAIL: 6th post not rate limited'; END IF;
  FOR _i IN 1..10 LOOP INSERT INTO public.community_post_comments(post_id,user_id,content) VALUES (_posts[1],_member,'c'); END LOOP;
  _ok := false; BEGIN INSERT INTO public.community_post_comments(post_id,user_id,content) VALUES (_posts[1],_member,'c11'); EXCEPTION WHEN OTHERS THEN _ok := SQLERRM LIKE 'rate_limited%'; END;
  IF NOT _ok THEN RAISE EXCEPTION 'FAIL: 11th comment not rate limited'; END IF;
  FOR _i IN 1..30 LOOP INSERT INTO public.community_post_likes(post_id,user_id) VALUES (_posts[_i],_member); END LOOP;
  _ok := false; BEGIN INSERT INTO public.community_post_likes(post_id,user_id) VALUES (_posts[31],_member); EXCEPTION WHEN OTHERS THEN _ok := SQLERRM LIKE 'rate_limited%'; END;
  IF NOT _ok THEN RAISE EXCEPTION 'FAIL: 31st like not rate limited'; END IF;
  RESET ROLE;

  -- 3. Admin exempt (already has 32 posts this minute)
  PERFORM set_config('request.jwt.claims', json_build_object('sub',_admin,'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  FOR _i IN 1..6 LOOP INSERT INTO public.community_posts(community_id,user_id,content) VALUES (_c,_admin,'a'); END LOOP;
  FOR _i IN 1..11 LOOP INSERT INTO public.community_post_comments(post_id,user_id,content) VALUES (_posts[1],_admin,'a'); END LOOP;
  FOR _i IN 2..31 LOOP INSERT INTO public.community_post_likes(post_id,user_id) VALUES (_posts[_i],_admin); END LOOP;
  RESET ROLE;

  RAISE EXCEPTION 'ALL_PASSED';
END $$;
