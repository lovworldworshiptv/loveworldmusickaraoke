
CREATE OR REPLACE FUNCTION public.get_public_karaoke(p_user_id uuid)
RETURNS TABLE(id uuid, song_id uuid, song_title text, audio_url text, created_at timestamptz, caption text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT kr.id, kr.song_id, kr.song_title, kr.audio_url, kr.created_at, kr.caption
  FROM public.karaoke_recordings kr
  WHERE kr.user_id = p_user_id AND kr.created_at > now() - interval '24 hours'
  ORDER BY kr.created_at DESC;
$$;
