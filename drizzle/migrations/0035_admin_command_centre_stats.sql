CREATE OR REPLACE FUNCTION public.admin_command_centre(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cutoff timestamptz := CASE WHEN p_days IS NULL OR p_days <= 0 THEN '-infinity'::timestamptz ELSE now() - make_interval(days => p_days) END;
  v_now timestamptz := now();
  v_orchestra uuid;
  result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_orchestra FROM public.categories WHERE lower(name) = 'orchestra' LIMIT 1;

  WITH eff AS (
    SELECT s.user_id,
      CASE WHEN s.subscription::text IN ('premium','trial') AND s.subscription_expiry_date IS NOT NULL AND s.subscription_expiry_date < v_now
           THEN 'free' ELSE s.subscription::text END AS tier,
      s.subscription_plan, s.subscription_expiry_date
    FROM public.user_subscriptions s
  ),
  plays AS (
    SELECT * FROM public.play_events WHERE created_at >= v_cutoff
  ),
  song_flags AS (
    SELECT s.*, (s.category_id = v_orchestra OR s.title ILIKE '%instrumental%') AS is_instr
    FROM public.songs s
  )
  SELECT jsonb_build_object(
    'generated_at', v_now,
    'range_days', p_days,
    'users', (SELECT jsonb_build_object(
        'total', count(*),
        'completed_profile', count(*) FILTER (WHERE profile_completed),
        'incomplete_profile', count(*) FILTER (WHERE NOT profile_completed),
        'new_in_range', count(*) FILTER (WHERE created_at >= v_cutoff),
        'new_7d', count(*) FILTER (WHERE created_at >= v_now - interval '7 days'),
        'with_location', count(*) FILTER (WHERE coalesce(nullif(trim(region),''), nullif(trim(zone),'')) IS NOT NULL),
        'without_location', count(*) FILTER (WHERE coalesce(nullif(trim(region),''), nullif(trim(zone),'')) IS NULL)
      ) FROM public.profiles),
    'roles', jsonb_build_object(
        'admin', (SELECT count(DISTINCT user_id) FROM public.user_roles WHERE role = 'admin'),
        'editor', (SELECT count(DISTINCT user_id) FROM public.user_roles WHERE role = 'editor')),
    'subs', (SELECT jsonb_build_object(
        'free', count(*) FILTER (WHERE tier = 'free'),
        'trial', count(*) FILTER (WHERE tier = 'trial'),
        'premium', count(*) FILTER (WHERE tier = 'premium'),
        'premium_1_month', count(*) FILTER (WHERE tier = 'premium' AND subscription_plan = '1_month'),
        'premium_3_months', count(*) FILTER (WHERE tier = 'premium' AND subscription_plan = '3_months'),
        'premium_6_months', count(*) FILTER (WHERE tier = 'premium' AND subscription_plan = '6_months'),
        'premium_1_year', count(*) FILTER (WHERE tier = 'premium' AND subscription_plan = '1_year'),
        'premium_other', count(*) FILTER (WHERE tier = 'premium' AND coalesce(subscription_plan,'') NOT IN ('1_month','3_months','6_months','1_year')),
        'expired_to_free', count(*) FILTER (WHERE tier = 'free' AND subscription_expiry_date < v_now),
        'expiring_premium', count(*) FILTER (WHERE tier = 'premium' AND subscription_expiry_date BETWEEN v_now AND v_now + interval '7 days'),
        'expiring_trial', count(*) FILTER (WHERE tier = 'trial' AND subscription_expiry_date BETWEEN v_now AND v_now + interval '7 days')
      ) FROM eff),
    'plays', (SELECT jsonb_build_object(
        'total', count(*),
        'song', count(*) FILTER (WHERE p.mode = 'song'),
        'karaoke', count(*) FILTER (WHERE p.mode = 'karaoke'),
        'video', count(*) FILTER (WHERE p.mode = 'video'),
        'guest', count(*) FILTER (WHERE p.user_id IS NULL),
        'songs_played', count(DISTINCT p.song_id),
        'listeners', count(DISTINCT p.user_id),
        'listeners_premium', count(DISTINCT p.user_id) FILTER (WHERE e.tier = 'premium'),
        'listeners_trial', count(DISTINCT p.user_id) FILTER (WHERE e.tier = 'trial'),
        'listeners_free', count(DISTINCT p.user_id) FILTER (WHERE coalesce(e.tier,'free') = 'free'),
        'all_time', (SELECT count(*) FROM public.play_events)
      ) FROM plays p LEFT JOIN eff e ON e.user_id = p.user_id),
    'songs', (SELECT jsonb_build_object(
        'total', count(*),
        'featured', count(*) FILTER (WHERE is_featured),
        'with_video', count(*) FILTER (WHERE has_video),
        'with_lyrics', count(*) FILTER (WHERE coalesce(lyrics_lrc,'') <> '' OR coalesce(lyrics_text,'') <> ''),
        'with_karaoke_track', count(*) FILTER (WHERE coalesce(instrumental_url,'') <> ''),
        'instrumentals', count(*) FILTER (WHERE is_instr),
        'free', count(*) FILTER (WHERE is_free_download)
      ) FROM song_flags),
    'favorites', (SELECT jsonb_build_object('total', count(*), 'in_range', count(*) FILTER (WHERE created_at >= v_cutoff),
        'users', count(DISTINCT user_id) FILTER (WHERE created_at >= v_cutoff), 'songs', count(DISTINCT song_id) FILTER (WHERE created_at >= v_cutoff))
      FROM public.favorites),
    'downloads', (SELECT jsonb_build_object('total', count(*) FILTER (WHERE deleted_at IS NULL),
        'in_range', count(*) FILTER (WHERE downloaded_at >= v_cutoff),
        'removed', count(*) FILTER (WHERE deleted_at IS NOT NULL),
        'users', count(DISTINCT user_id) FILTER (WHERE downloaded_at >= v_cutoff), 'songs', count(DISTINCT song_id) FILTER (WHERE downloaded_at >= v_cutoff))
      FROM public.downloads),
    'recordings', (SELECT jsonb_build_object('total', count(*), 'in_range', count(*) FILTER (WHERE created_at >= v_cutoff),
        'singers', count(DISTINCT user_id) FILTER (WHERE created_at >= v_cutoff),
        'live_24h', count(*) FILTER (WHERE created_at >= v_now - interval '24 hours'))
      FROM public.karaoke_recordings),
    'articles', (SELECT jsonb_build_object('total', count(*), 'published', count(*) FILTER (WHERE is_published),
        'drafts', count(*) FILTER (WHERE NOT is_published), 'featured', count(*) FILTER (WHERE is_featured AND is_published),
        'reads_in_range', (SELECT count(*) FROM public.analytics_events WHERE event_type = 'article_read' AND created_at >= v_cutoff))
      FROM public.articles),
    'games', (SELECT jsonb_build_object('total', count(*), 'in_range', count(*) FILTER (WHERE created_at >= v_cutoff),
        'players', count(DISTINCT user_id) FILTER (WHERE created_at >= v_cutoff),
        'by_mode', coalesce((SELECT jsonb_object_agg(game_mode, n) FROM (SELECT game_mode, count(*) n FROM public.game_sessions WHERE created_at >= v_cutoff GROUP BY 1) m), '{}'::jsonb))
      FROM public.game_sessions),
    'stems', (SELECT jsonb_build_object('total', count(*),
        'pending', count(*) FILTER (WHERE status = 'pending'), 'processing', count(*) FILTER (WHERE status = 'processing'),
        'ready', count(*) FILTER (WHERE status = 'ready'), 'failed', count(*) FILTER (WHERE status = 'failed'))
      FROM public.song_audio_versions WHERE kind = 'instrumental'),
    'alerts', (SELECT jsonb_build_object('total', count(*), 'unread', count(*) FILTER (WHERE NOT is_read),
        'unread_by_type', coalesce((SELECT jsonb_object_agg(type, n) FROM (SELECT type, count(*) n FROM public.admin_notifications WHERE NOT is_read GROUP BY 1) t), '{}'::jsonb))
      FROM public.admin_notifications),
    'issues', (SELECT jsonb_build_object(
        'artwork', count(*) FILTER (WHERE coalesce(cover_url,'') = ''),
        'audio', count(*) FILTER (WHERE coalesce(audio_url,'') = ''),
        'lyrics', count(*) FILTER (WHERE NOT is_instr AND coalesce(lyrics_lrc,'') = '' AND coalesce(lyrics_text,'') = ''),
        'karaoke_track', count(*) FILTER (WHERE NOT is_instr AND coalesce(instrumental_url,'') = ''),
        'video', count(*) FILTER (WHERE NOT has_video),
        'category', count(*) FILTER (WHERE category_id IS NULL),
        'songs_affected', count(*) FILTER (WHERE coalesce(cover_url,'') = '' OR coalesce(audio_url,'') = ''
            OR (NOT is_instr AND coalesce(lyrics_lrc,'') = '' AND coalesce(lyrics_text,'') = '')
            OR (NOT is_instr AND coalesce(instrumental_url,'') = '') OR NOT has_video OR category_id IS NULL)
      ) FROM song_flags),
    'play_days', coalesce((SELECT jsonb_agg(jsonb_build_object('date', d, 'plays', n, 'karaoke', k, 'video', v) ORDER BY d)
        FROM (SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') d, count(*) n, count(*) FILTER (WHERE mode = 'karaoke') k, count(*) FILTER (WHERE mode = 'video') v FROM plays GROUP BY 1) x), '[]'::jsonb),
    'user_days', coalesce((SELECT jsonb_agg(jsonb_build_object('date', d, 'users', n) ORDER BY d)
        FROM (SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') d, count(*) n FROM public.profiles WHERE created_at >= v_cutoff GROUP BY 1) x), '[]'::jsonb),
    'top_songs', coalesce((SELECT jsonb_agg(row_to_json(t) ORDER BY t.engagement DESC, t.title) FROM (
        SELECT s.id, s.title, s.artist, s.cover_url,
          coalesce(pl.plays,0) plays, coalesce(pl.listeners,0) listeners,
          coalesce(pl.karaoke_plays,0) + coalesce(rc.n,0) karaoke,
          coalesce(fv.n,0) favorites, coalesce(dl.n,0) downloads,
          coalesce(pl.plays,0) + (coalesce(pl.karaoke_plays,0) + coalesce(rc.n,0)) * 3 + coalesce(fv.n,0) * 2 + coalesce(dl.n,0) * 2 engagement
        FROM public.songs s
        LEFT JOIN (SELECT song_id, count(*) plays, count(DISTINCT user_id) listeners, count(*) FILTER (WHERE mode='karaoke') karaoke_plays FROM plays GROUP BY 1) pl ON pl.song_id = s.id
        LEFT JOIN (SELECT song_id, count(*) n FROM public.karaoke_recordings WHERE created_at >= v_cutoff GROUP BY 1) rc ON rc.song_id = s.id
        LEFT JOIN (SELECT song_id, count(*) n FROM public.favorites WHERE created_at >= v_cutoff GROUP BY 1) fv ON fv.song_id = s.id
        LEFT JOIN (SELECT song_id, count(*) n FROM public.downloads WHERE downloaded_at >= v_cutoff GROUP BY 1) dl ON dl.song_id = s.id
        ORDER BY engagement DESC, s.title LIMIT 25) t), '[]'::jsonb),
    'engaged', coalesce((SELECT jsonb_agg(row_to_json(t) ORDER BY t.plays DESC) FROM (
        SELECT p.user_id, pr.username, pr.avatar_url, count(*) plays FROM plays p LEFT JOIN public.profiles pr ON pr.user_id = p.user_id
        WHERE p.user_id IS NOT NULL GROUP BY 1,2,3 ORDER BY plays DESC LIMIT 8) t), '[]'::jsonb),
    'locations', coalesce((SELECT jsonb_agg(row_to_json(t) ORDER BY t.users DESC) FROM (
        SELECT coalesce(nullif(trim(region),''), nullif(trim(zone),'')) AS name, count(*) users FROM public.profiles
        WHERE coalesce(nullif(trim(region),''), nullif(trim(zone),'')) IS NOT NULL GROUP BY 1 ORDER BY users DESC LIMIT 8) t), '[]'::jsonb),
    'locations_count', (SELECT count(DISTINCT coalesce(nullif(trim(region),''), nullif(trim(zone),''))) FROM public.profiles),
    'create_menu', coalesce((SELECT jsonb_object_agg(k, n) FROM (SELECT event_data->>'option' k, count(*) n FROM public.analytics_events
        WHERE event_type = 'create_menu_click' AND created_at >= v_cutoff AND event_data->>'option' IS NOT NULL GROUP BY 1) x), '{}'::jsonb),
    'channels', coalesce((SELECT jsonb_agg(row_to_json(t)) FROM (
        SELECT coalesce(nullif(CASE WHEN event_type = 'app_download_click' THEN event_data->>'source' ELSE event_data->>'channel' END, ''), 'direct') AS channel,
          count(*) FILTER (WHERE event_type = 'share_click') shares,
          count(*) FILTER (WHERE event_type = 'share_visit') visits,
          count(*) FILTER (WHERE event_type = 'referral_signup') signups,
          count(*) FILTER (WHERE event_type = 'app_download_click') downloads
        FROM public.analytics_events
        WHERE event_type IN ('share_click','share_visit','referral_signup','app_download_click') AND created_at >= v_cutoff GROUP BY 1) t), '[]'::jsonb),
    'download_surfaces', coalesce((SELECT jsonb_agg(row_to_json(t) ORDER BY t.clicks DESC) FROM (
        SELECT coalesce(event_data->>'surface','unknown') || ' · ' || coalesce(event_data->>'platform','web') AS name, count(*) clicks
        FROM public.analytics_events WHERE event_type = 'app_download_click' AND created_at >= v_cutoff GROUP BY 1) t), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_command_centre(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_command_centre(integer) TO authenticated;