CREATE OR REPLACE FUNCTION public.search_voice(query text, page_limit int DEFAULT 20)
RETURNS TABLE(kind text, id uuid, song_id uuid, title text, subtitle text, cover_url text, snippet text, tier int, score real)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public, extensions AS $$
DECLARE
  q text := btrim(regexp_replace(regexp_replace(public.search_norm(query), '[^[:alnum:][:space:]]+', ' ', 'g'), '\s+', ' ', 'g'));
  words text[];
  toks text[];
  pairs tsquery[];
  tok_q tsquery[];
  tok_ab tsquery[];
  n int; np int;
  tq_or tsquery;
BEGIN
  IF length(q) < 2 THEN RETURN; END IF;
  words := ARRAY(SELECT w FROM unnest(string_to_array(q, ' ')) w WHERE length(w) >= 2);
  IF coalesce(array_length(words, 1), 0) = 0 THEN RETURN; END IF;
  words := words[1:24];
  toks := ARRAY(SELECT DISTINCT w FROM unnest(words) w);
  n := array_length(toks, 1);
  -- Prefix matching for longer words tolerates plural/tense slips in transcripts.
  tok_q := ARRAY(SELECT to_tsquery('simple', quote_literal(t) || CASE WHEN length(t) >= 3 THEN ':*' ELSE '' END) FROM unnest(toks) t);
  tok_ab := ARRAY(SELECT to_tsquery('simple', quote_literal(t) || CASE WHEN length(t) >= 3 THEN ':*AB' ELSE ':AB' END) FROM unnest(toks) t);
  tq_or := to_tsquery('simple', array_to_string(ARRAY(SELECT quote_literal(t) || CASE WHEN length(t) >= 3 THEN ':*' ELSE '' END FROM unnest(toks) t), ' | '));
  -- Neighbouring word pairs: one misheard word only breaks the two pairs around it.
  pairs := ARRAY(SELECT to_tsquery('simple', quote_literal(words[i]) || ' <-> ' || quote_literal(words[i + 1]))
                 FROM generate_series(1, array_length(words, 1) - 1) i);
  np := coalesce(array_length(pairs, 1), 0);
  page_limit := LEAST(GREATEST(coalesce(page_limit, 20), 1), 50);

  RETURN QUERY
  WITH c AS (
    SELECT x.id, x.title, x.artist, x.cover_url, x.search_tsv tsv, public.search_norm(x.title) nt
    FROM songs x
    WHERE x.search_tsv @@ tq_or OR public.search_norm(x.title) % q
  ), m AS (
    SELECT c.*,
      (SELECT count(*) FROM unnest(tok_q) t WHERE c.tsv @@ t)::real / n AS cov,
      (SELECT count(*) FROM unnest(tok_ab) t WHERE c.tsv @@ t)::real / n AS cov_ab,
      CASE WHEN np = 0 THEN 0 ELSE (SELECT count(*) FROM unnest(pairs) p WHERE c.tsv @@ p)::real / np END AS pair_cov,
      GREATEST(
        similarity(c.nt, q),
        word_similarity(q, c.nt),
        word_similarity(c.nt, q) * LEAST(1.0, length(c.nt)::real / GREATEST(length(q), 1))
      )::real AS tsim
    FROM c
  ), r AS (
    SELECT m.*,
      CASE WHEN m.nt = q THEN 1
           WHEN m.tsim >= 0.55 OR (m.cov_ab = 1 AND n <= 6) THEN 2
           ELSE 4 END AS tr,
      (4 * m.tsim + 3 * m.pair_cov + 2 * m.cov + 2 * m.cov_ab + ts_rank_cd(m.tsv, tq_or))::real AS sc
    FROM m
    WHERE m.nt = q
       OR m.tsim >= 0.45
       OR (n <= 2 AND m.cov = 1)
       OR (n > 2 AND (m.pair_cov >= 0.34 OR (m.cov >= 0.7 AND m.pair_cov > 0)))
  )
  SELECT 'song'::text, r.id, r.id, r.title, r.artist, r.cover_url, NULL::text, r.tr, r.sc
  FROM r
  ORDER BY (r.tr = 1) DESC, r.sc DESC, length(r.title), r.title
  LIMIT page_limit;
END $$;
GRANT EXECUTE ON FUNCTION public.search_voice(text, int) TO anon, authenticated;