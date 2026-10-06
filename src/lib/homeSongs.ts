import { supabase } from "@/integrations/supabase/client";
import type { PlayerSong } from "@/contexts/PlayerContext";

export const SONG_COLUMNS =
  "id,title,artist,album,cover_url,audio_url,instrumental_url,lyrics_lrc,duration_seconds,category_id,original_language";

export type SongRow = {
  id: string; title: string; artist: string; album: string | null; cover_url: string | null;
  audio_url: string | null; instrumental_url: string | null; lyrics_lrc: string | null;
  duration_seconds: number; category_id: string | null; original_language?: string | null;
};

export const toPlayerSong = (s: SongRow): PlayerSong => ({
  id: s.id, title: s.title, artist: s.artist, album: s.album || undefined,
  coverUrl: s.cover_url || undefined, audioUrl: s.audio_url || undefined,
  instrumentalUrl: s.instrumental_url || undefined, lyricsLrc: s.lyrics_lrc || undefined,
  durationSeconds: s.duration_seconds,
});

/** Loads songs by id preserving the given order. */
export async function fetchSongsByIds(ids: string[]): Promise<SongRow[]> {
  if (!ids.length) return [];
  const { data } = await supabase.from("songs").select(SONG_COLUMNS).in("id", ids);
  const map = new Map((data as SongRow[] | null || []).map((s) => [s.id, s]));
  return ids.map((id) => map.get(id)).filter(Boolean) as SongRow[];
}
