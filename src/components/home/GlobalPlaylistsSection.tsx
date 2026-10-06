import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { ListMusic, Play } from "lucide-react";
import { cardGradient, DEFAULT_GLOBAL_CARD } from "@/lib/siteSettings";
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
  card_color: string | null;
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

/** Global playlist cards styled like the Recommended Playlists cards, with a deep purple gradient. */
const GlobalPlaylistsSection = () => {
  const [playlists, setPlaylists] = useState<GlobalPlaylist[]>([]);
  const navigate = useNavigate();
  const { playQueue } = usePlayer();

  useEffect(() => {
    const fetchGlobalPlaylists = async () => {
      const { data } = await supabase
        .from("playlists")
        .select(
          "id, name, cover_url, card_color, playlist_songs(sort_order, songs(id, title, artist, album, cover_url, audio_url, instrumental_url, lyrics_lrc, duration_seconds))",
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

      <div className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2 touch-pan-x">
        {playlists.map((playlist) => {
          const orderedSongs = (playlist.playlist_songs || [])
            .filter((item): item is PlaylistSongRow & { songs: NonNullable<PlaylistSongRow["songs"]> } => !!item.songs)
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((item) => toPlayerSong(item.songs));

          const cover = playlist.cover_url || orderedSongs[0]?.coverUrl;
          const names = orderedSongs.slice(0, 3).map((s) => s.title).join(", ");

          return (
            <div
              key={playlist.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/collection/${playlist.id}?color=${encodeURIComponent(playlist.card_color || DEFAULT_GLOBAL_CARD)}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") navigate(`/collection/${playlist.id}?color=${encodeURIComponent(playlist.card_color || DEFAULT_GLOBAL_CARD)}`);
              }}
              className="snap-start flex-shrink-0 w-full md:w-[calc(50%_-_0.375rem)] lg:w-[29.6%] h-[166px] md:h-36 rounded-2xl p-3 text-left cursor-pointer border-0 shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              style={{ background: cardGradient(playlist.card_color || DEFAULT_GLOBAL_CARD) }}
            >
              <div className="flex h-full gap-3">
                <div className="aspect-square h-full rounded-xl overflow-hidden flex-shrink-0 bg-muted">
                  {cover ? (
                    <img src={cover} alt={playlist.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ListMusic className="w-8 h-8 text-gold/60" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-gold">Playlist · {orderedSongs.length} songs</span>
                  <p className="font-serif font-bold text-foreground truncate mt-0.5">{playlist.name}</p>
                  <p className="text-xs text-white line-clamp-2 mt-1">{names || "Worship collection"}</p>
                  {orderedSongs.length > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        playQueue(orderedSongs);
                      }}
                      aria-label={`Play ${playlist.name}`}
                      className="mt-auto self-end w-9 h-9 rounded-full gradient-gold flex items-center justify-center shadow-[0_2px_12px_hsl(var(--gold)/0.4)]"
                    >
                      <Play className="w-4 h-4 text-primary-foreground ml-0.5" fill="currentColor" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default GlobalPlaylistsSection;
