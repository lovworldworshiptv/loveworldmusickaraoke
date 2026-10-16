import { supabase } from "@/integrations/supabase/client";

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
  const hits = (data || []) as ContentHit[];
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
