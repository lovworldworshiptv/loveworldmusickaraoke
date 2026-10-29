import { supabase } from "@/integrations/supabase/client";
import { bestLyricLines } from "@/lib/voiceSearch";

export const SEARCH_DEBOUNCE_MS = 250;
export const SEARCH_PAGE_SIZE = 20;

export type SearchScope = "all" | "songs" | "lyrics" | "articles";

export interface ContentHit {
  kind: "song" | "lyrics" | "article";
  id: string;
  song_id: string | null;
  title: string;
  subtitle: string | null;
  cover_url: string | null;
  snippet: string | null;
  tier: number;
  score: number;
}

const SONG_COLS =
  "id, title, artist, cover_url, audio_url, instrumental_url, lyrics_lrc, lyrics_text, duration_seconds, album, has_video, play_count";

/**
 * Ranked server-side search (exact title → title prefix → all words in title/artist → lyrics → fuzzy).
 * Returns full song rows in rank order plus article hits.
 * - `songs`: every matched song (title/artist or lyrics), for playback queues.
 * - `titleIds`: ids matched by title/artist only — the "Songs" category.
 * - `lyrics`: songs matched via lyrics, each carrying its matching snippet — the "Lyrics" category.
 * `hasMore` signals another page exists.
 */
export async function searchContent(query: string, scope: SearchScope = "all", limit = SEARCH_PAGE_SIZE, offset = 0) {
  const { data, error } = await (supabase as any).rpc("search_content", {
    query, scope, page_limit: limit, page_offset: offset,
  });
  if (error) throw error;
  return hitsToResults((data || []) as ContentHit[], limit);
}

/**
 * Voice search: spoken titles and sung lyric lines are long and may contain a misheard word,
 * so songs are ranked by search_voice (title similarity + word-pair and word coverage)
 * instead of requiring every word. Articles still use the regular ranking.
 */
export async function searchVoiceContent(query: string, limit = SEARCH_PAGE_SIZE) {
  const [voice, articles] = await Promise.all([
    (supabase as any).rpc("search_voice", { query, page_limit: limit }),
    (supabase as any).rpc("search_content", { query, scope: "articles", page_limit: 5, page_offset: 0 }),
  ]);
  if (voice.error) throw voice.error;
  const res = await hitsToResults([...((voice.data || []) as ContentHit[]), ...((articles.data || []) as ContentHit[])], Infinity);
  res.lyrics = res.lyrics.map((s: any) => ({ ...s, lyrics_text: bestLyricLines(s.lyrics_text || s.lyrics_lrc, query) || s.lyrics_text }));
  return { ...res, hasMore: false };
}

async function hitsToResults(hits: ContentHit[], limit: number) {
  const songIds = [...new Set(hits.filter(h => h.kind !== "article").map(h => h.song_id || h.id))];
  let songs: any[] = [];
  let lyrics: any[] = [];
  let titleIds = new Set<string>();
  if (songIds.length) {
    const { data: rows } = await supabase.from("songs").select(SONG_COLS).in("id", songIds);
    const byId = new Map((rows || []).map((r: any) => [r.id, r]));
    // Tier 4 = matched inside lyrics; kind "lyrics" = matched a translated lyric row.
    const isLyricHit = (h: ContentHit) => h.kind === "lyrics" || (h.kind === "song" && h.tier === 4);
    titleIds = new Set(hits.filter(h => h.kind === "song" && h.tier !== 4).map(h => h.song_id || h.id) as string[]);
    songs = songIds.map(id => byId.get(id)).filter(Boolean);
    const seenLyric = new Set<string>();
    lyrics = hits
      .filter(isLyricHit)
      .map(h => {
        const id = (h.song_id || h.id) as string;
        if (titleIds.has(id) || seenLyric.has(id)) return null;
        seenLyric.add(id);
        const row: any = byId.get(id);
        return row ? { ...row, lyrics_text: h.snippet || row.lyrics_text } : null;
      })
      .filter(Boolean);
  }
  const articles = hits.filter(h => h.kind === "article").map(h => ({
    id: h.id, title: h.title, author: h.subtitle, excerpt: h.snippet, image_url: h.cover_url,
  }));
  return { songs, lyrics, titleIds, articles, hasMore: hits.length === limit };
}
