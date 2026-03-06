import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { ListMusic, Play } from "lucide-react";
import { usePlayer, type PlayerSong } from "@/contexts/PlayerContext";

interface PlaylistSongRow {
  sort_order: number;
  songs: {
    id: string;
    title: string;
    artist: string;
    album: string | null;
    cover_url: string | null;
    audio_url: string | null;
    instrumental_url: string | null;
    lyrics_lrc: string | null;
    duration_seconds: number;
  } | null;
}

interface GlobalPlaylist {
  id: string;
  name: string;
  cover_url: string | null;
  playlist_songs: PlaylistSongRow[] | null;
}

const toPlayerSong = (song: NonNullable<PlaylistSongRow["songs"]>): PlayerSong => ({
  id: song.id,
  title: song.title,
  artist: song.artist,
  album: song.album || undefined,
  coverUrl: song.cover_url || undefined,
  audioUrl: song.audio_url || undefined,
  instrumentalUrl: song.instrumental_url || undefined,
  lyricsLrc: song.lyrics_lrc || undefined,
  durationSeconds: song.duration_seconds,
});

const GlobalPlaylistsSection = () => {
  const [playlists, setPlaylists] = useState<GlobalPlaylist[]>([]);
  const navigate = useNavigate();
  const { playQueue } = usePlayer();

  useEffect(() => {
    const fetchGlobalPlaylists = async () => {
      const { data } = await supabase
        .from("playlists")
        .select(
          "id, name, cover_url, playlist_songs(sort_order, songs(id, title, artist, album, cover_url, audio_url, instrumental_url, lyrics_lrc, duration_seconds))",
        )
        .eq("is_visible_on_homepage", true)
        .order("created_at", { ascending: false })
        .limit(10);

      if (data) {
        setPlaylists(data as unknown as GlobalPlaylist[]);
      }
    };

    fetchGlobalPlaylists();
  }, []);

  if (playlists.length === 0) return null;

  return (
    <section className="px-4 lg:px-6 mt-8 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-serif font-bold text-foreground">Global Playlists</h3>
        <button
          onClick={() => navigate("/playlists")}
          className="text-xs text-gold hover:text-gold-light font-medium transition-colors duration-200"
        >
          See All
        </button>
      </div>

      <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-1 px-1">
        {playlists.map((playlist, i) => {
          const orderedSongs = (playlist.playlist_songs || [])
            .filter((item): item is PlaylistSongRow & { songs: NonNullable<PlaylistSongRow["songs"]> } => !!item.songs)
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((item) => toPlayerSong(item.songs));

          const cover = playlist.cover_url || orderedSongs[0]?.coverUrl;

          return (
            <div
              key={playlist.id}
              className="group flex-shrink-0 w-48 text-left animate-fade-in-up"
              style={{ animationDelay: `${i * 0.06}s` }}
            >
              <button
                onClick={() => navigate("/playlists")}
                className="relative w-full aspect-[4/3] rounded-xl overflow-hidden mb-3 glass-card transition-all duration-300 group-hover:shadow-[0_8px_32px_hsl(43_70%_53%/0.12)]"
              >
                {cover ? (
                  <img src={cover} alt={playlist.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                ) : (
                  <div className="w-full h-full gradient-purple flex items-center justify-center">
                    <ListMusic className="w-10 h-10 text-gold/30" />
                  </div>
                )}

                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/85 to-transparent p-3">
                  <p className="text-sm font-medium text-foreground truncate">{playlist.name}</p>
                  <p className="text-xs text-muted-foreground">{orderedSongs.length} songs</p>
                </div>
              </button>

              {orderedSongs.length > 0 && (
                <button
                  onClick={() => playQueue(orderedSongs)}
                  className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-muted hover:bg-muted/70 px-3 py-2 text-xs text-foreground transition-colors"
                >
                  <Play className="w-3.5 h-3.5" fill="currentColor" /> Play Playlist
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default GlobalPlaylistsSection;
