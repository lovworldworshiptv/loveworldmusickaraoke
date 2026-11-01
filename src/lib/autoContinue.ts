import { supabase } from "@/integrations/supabase/client";
import type { PlayerSong } from "@/contexts/PlayerContext";
import { SONG_COLUMNS, toPlayerSong, type SongRow } from "@/lib/homeSongs";

export type ContinueMode = "song" | "karaoke" | "video";

/** Whether a song can be played in the given mode (karaoke needs a backing track). */
export function playableIn(mode: ContinueMode, song: Pick<PlayerSong, "audioUrl" | "instrumentalUrl">): boolean {
  if (mode === "karaoke") return !!song.instrumentalUrl;
  return !!(song.audioUrl || song.instrumentalUrl);
}

/** Drops songs already queued (or repeated), keeps only ones playable in the mode, shuffles and caps. */
export function pickContinuation(
  rows: PlayerSong[],
  excludeIds: Iterable<string>,
  mode: ContinueMode,
  limit = 20,
  random: () => number = Math.random,
): PlayerSong[] {
  const seen = new Set(excludeIds);
  const out: PlayerSong[] = [];
  for (const s of rows) {
    if (seen.has(s.id) || !playableIn(mode, s)) continue;
    seen.add(s.id);
    out.push(s);
  }
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.slice(0, limit);
}

function randomPivot(): string {
  try { return crypto.randomUUID(); } catch { return "00000000-0000-4000-8000-000000000000"; }
}

/**
 * More songs for the same mode once the queue runs out, so a session keeps going
 * until the listener changes it: any song for Song mode, songs with a backing track
 * for Karaoke, songs with a video for Video. Starts from a random point in the catalogue.
 */
export async function fetchContinuation(mode: ContinueMode, excludeIds: string[], limit = 20): Promise<PlayerSong[]> {
  const base = () => {
    let q = supabase.from("songs").select(SONG_COLUMNS);
    if (mode === "karaoke") q = q.not("instrumental_url", "is", null);
    else q = q.not("audio_url", "is", null);
    if (mode === "video") q = q.eq("has_video", true);
    return q;
  };
  const want = limit + Math.min(excludeIds.length, 40);
  const pivot = randomPivot();
  const first = await base().gt("id", pivot).order("id").limit(want);
  let rows = ((first.data as SongRow[] | null) || []);
  if (rows.length < want) {
    const rest = await base().order("id").limit(want - rows.length);
    rows = rows.concat((rest.data as SongRow[] | null) || []);
  }
  return pickContinuation(rows.map(toPlayerSong), excludeIds, mode, limit);
}
