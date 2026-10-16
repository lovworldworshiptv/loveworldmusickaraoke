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
 * Returns full song rows in rank order plus article hits. `hasMore` signals another page exists.
 */
export async function searchContent(query: string, scope: SearchScope = "all", limit = SEARCH_PAGE_SIZE, offset = 0) {
  const { data, error } = await (supabase as any).rpc("search_content", {
    query, scope, page_limit: limit, page_offset: offset,
  });
  if (error) throw error;
  const hits = (data || []) as ContentHit[];
  const songIds = [...new Set(hits.filter(h => h.kind !== "article").map(h => h.song_id || h.id))];
  let songs: any[] = [];
  if (songIds.length) {
    const { data: rows } = await supabase.from("songs").select(SONG_COLS).in("id", songIds);
    const byId = new Map((rows || []).map((r: any) => [r.id, r]));
    songs = songIds.map(id => {
      const row: any = byId.get(id);
      if (!row) return null;
      const lyricHit = hits.find(h => h.kind === "lyrics" && h.song_id === id);
      return lyricHit?.snippet ? { ...row, lyrics_text: lyricHit.snippet } : row;
    }).filter(Boolean);
  }
  const articles = hits.filter(h => h.kind === "article").map(h => ({
    id: h.id, title: h.title, author: h.subtitle, excerpt: h.snippet, image_url: h.cover_url,
  }));
  return { songs, articles, hasMore: hits.length === limit };
}
