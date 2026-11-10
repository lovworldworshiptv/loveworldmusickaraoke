export type PlaylistEntry = {
  id: string;
  sort_order?: number | null;
  songs?: { cover_url?: string | null } | null;
};

export function orderedPlaylistEntries<T extends PlaylistEntry>(entries: T[]): T[] {
  return [...entries].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id.localeCompare(b.id));
}

/** Personal playlists follow track one; official playlists retain CMS artwork. */
export function playlistArtwork(playlist: { cover_url?: string | null; playlist_songs?: PlaylistEntry[] }, personal = true): string | null {
  const first = orderedPlaylistEntries(playlist.playlist_songs ?? []).find((entry) => entry.songs);
  return personal ? first?.songs?.cover_url || null : playlist.cover_url || first?.songs?.cover_url || null;
}

export function nextPlaylistOrder(entries: { sort_order?: number | null }[]): number {
  return entries.reduce((max, entry) => Math.max(max, entry.sort_order ?? -1), -1) + 1;
}