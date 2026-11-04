CREATE OR REPLACE FUNCTION public.get_video_comment_count(p_video_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM video_comments WHERE song_video_id = p_video_id AND is_deleted = false;
$$;
GRANT EXECUTE ON FUNCTION public.get_video_comment_count(uuid) TO anon, authenticated;