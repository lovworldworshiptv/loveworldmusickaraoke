CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.search_norm(t text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = public, extensions AS
$$ SELECT lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(t,''))) $$;

ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS search_tsv tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('simple', public.search_norm(title)), 'A') ||
  setweight(to_tsvector('simple', public.search_norm(coalesce(artist,'') || ' ' || coalesce(album,''))), 'B') ||
  setweight(to_tsvector('simple', public.search_norm(left(coalesce(lyrics_text, regexp_replace(coalesce(lyrics_lrc,''), '\[[^\]]*\]', ' ', 'g')), 20000))), 'C')
) STORED;
CREATE INDEX IF NOT EXISTS songs_search_tsv_idx ON public.songs USING gin (search_tsv);
CREATE INDEX IF NOT EXISTS songs_title_trgm_idx ON public.songs USING gin (public.search_norm(title) extensions.gin_trgm_ops);

ALTER TABLE public.song_lyrics ADD COLUMN IF NOT EXISTS search_tsv tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('simple', public.search_norm(left(coalesce(lyrics_text, regexp_replace(coalesce(lyrics_lrc,''), '\[[^\]]*\]', ' ', 'g')), 20000))), 'C')
) STORED;
CREATE INDEX IF NOT EXISTS song_lyrics_search_tsv_idx ON public.song_lyrics USING gin (search_tsv);

ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS search_tsv tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('simple', public.search_norm(title)), 'A') ||
  setweight(to_tsvector('simple', public.search_norm(coalesce(author,'') || ' ' || coalesce(category,''))), 'B') ||
  setweight(to_tsvector('simple', public.search_norm(coalesce(excerpt,'') || ' ' || left(coalesce(content,''), 20000))), 'C')
) STORED;
CREATE INDEX IF NOT EXISTS articles_search_tsv_idx ON public.articles USING gin (search_tsv);
CREATE INDEX IF NOT EXISTS articles_title_trgm_idx ON public.articles USING gin (public.search_norm(title) extensions.gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.search_content(query text, scope text DEFAULT 'all', page_limit int DEFAULT 20, page_offset int DEFAULT 0)
RETURNS TABLE(kind text, id uuid, song_id uuid, title text, subtitle text, cover_url text, snippet text, tier int, score real)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public, extensions AS $$
DECLARE
  q text := btrim(regexp_replace(public.search_norm(query), '[^[:alnum:][:space:]]+', ' ', 'g'));
  toks text[]; tq tsquery; tq_ab tsquery;
BEGIN
  IF length(q) < 2 THEN RETURN; END IF;
  q := regexp_replace(q, '\s+', ' ', 'g');
  toks := string_to_array(q, ' ');
  tq := to_tsquery('simple', array_to_string(ARRAY(SELECT quote_literal(t) || ':*' FROM unnest(toks) t), ' & '));
  tq_ab := to_tsquery('simple', array_to_string(ARRAY(SELECT quote_literal(t) || ':*AB' FROM unnest(toks) t), ' & '));
  page_limit := LEAST(GREATEST(coalesce(page_limit,20),1),50);
  page_offset := GREATEST(coalesce(page_offset,0),0);
  RETURN QUERY
  WITH s AS (
    SELECT 'song'::text k, x.id, x.id sid, x.title, x.artist sub, x.cover_url cov, NULL::text snip,
      CASE WHEN public.search_norm(x.title) = q THEN 1
           WHEN public.search_norm(x.title) LIKE q || '%' THEN 2
           WHEN x.search_tsv @@ tq_ab THEN 3
           WHEN x.search_tsv @@ tq THEN 4 ELSE 5 END t,
      (ts_rank(x.search_tsv, tq) + similarity(public.search_norm(x.title), q))::real sc
    FROM songs x
    WHERE scope IN ('all','songs','lyrics') AND (x.search_tsv @@ tq OR public.search_norm(x.title) % q)
  ), l AS (
    SELECT 'lyrics'::text, y.id, y.song_id, x.title, x.artist || ' · ' || y.language_code, x.cover_url,
      left(coalesce(y.lyrics_text, y.lyrics_lrc), 400), 4, ts_rank(y.search_tsv, tq)::real
    FROM song_lyrics y JOIN songs x ON x.id = y.song_id
    WHERE scope IN ('all','lyrics') AND y.search_tsv @@ tq
      AND NOT EXISTS (SELECT 1 FROM s WHERE s.id = y.song_id)
  ), a AS (
    SELECT 'article'::text, z.id, NULL::uuid, z.title, z.author, z.image_url, z.excerpt,
      CASE WHEN public.search_norm(z.title) = q THEN 1
           WHEN public.search_norm(z.title) LIKE q || '%' THEN 2
           WHEN z.search_tsv @@ tq_ab THEN 3
           WHEN z.search_tsv @@ tq THEN 4 ELSE 5 END,
      (ts_rank(z.search_tsv, tq) + similarity(public.search_norm(z.title), q))::real
    FROM articles z
    WHERE scope IN ('all','articles') AND z.is_published AND (z.search_tsv @@ tq OR public.search_norm(z.title) % q)
  ), u AS (SELECT * FROM s UNION ALL SELECT * FROM l UNION ALL SELECT * FROM a)
  SELECT u.k, u.id, u.sid, u.title, u.sub, u.cov, u.snip, u.t, u.sc FROM u
  ORDER BY u.t, u.sc DESC, length(u.title), u.title
  LIMIT page_limit OFFSET page_offset;
END $$;
GRANT EXECUTE ON FUNCTION public.search_content(text,text,int,int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_norm(text) TO anon, authenticated;