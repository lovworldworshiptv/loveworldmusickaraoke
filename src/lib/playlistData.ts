import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAll";
import { orderedPlaylistEntries } from "@/lib/playlistArtwork";

const SONG_FIELDS = "id,title,artist,cover_url,audio_url,instrumental_url,lyrics_lrc,lyrics_text,duration_seconds,album,category_id,original_language,is_free_download";

/** Page child rows separately: paging playlists cannot page embedded songs. */
export async function loadPlaylists(userId?: string, includeSongs = true): Promise<any[]> {
  const playlists = await fetchAllRows((from, to) => {
    let query = supabase.from("playlists").select("id,name,description,cover_url,created_at,user_id");
    if (userId) query = query.eq("user_id", userId);
    return query.order("created_at", { ascending: false }).order("id").range(from, to);
  });
  if (!includeSongs || !playlists.length) return playlists;
  const grouped = new Map<string, any[]>();
  for (let start = 0; start < playlists.length; start += 100) {
    const ids = playlists.slice(start, start + 100).map((playlist) => playlist.id);
    const entries = await fetchAllRows((from, to) => supabase.from("playlist_songs")
      .select(`id,playlist_id,song_id,sort_order,songs(${SONG_FIELDS})`)
      .in("playlist_id", ids).order("sort_order").order("id").range(from, to));
    for (const entry of entries) {
      const list = grouped.get(entry.playlist_id) ?? [];
      list.push(entry);
      grouped.set(entry.playlist_id, list);
    }
  }
  return playlists.map((playlist) => ({ ...playlist, playlist_songs: orderedPlaylistEntries(grouped.get(playlist.id) ?? []) }));
}

export async function loadPlaylistEntries(playlistId: string) {
  return fetchAllRows((from, to) => supabase.from("playlist_songs")
    .select(`id,song_id,sort_order,songs(${SONG_FIELDS})`)
    .eq("playlist_id", playlistId).order("sort_order").order("id").range(from, to));
}