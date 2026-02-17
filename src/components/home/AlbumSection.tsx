import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer, type PlayerSong } from "@/contexts/PlayerContext";
import { Play, Pause, Disc3, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Album {
  id: string;
  title: string;
  artist: string;
  cover_url: string | null;
  songs: PlayerSong[];
}

const AlbumSection = () => {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const { playSong, playQueue, currentSong, isPlaying } = usePlayer();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAlbums = async () => {
      // Fetch top albums
      const { data: albumData } = await supabase
        .from("albums")
        .select("*")
        .eq("is_top", true)
        .order("created_at", { ascending: false });

      if (!albumData || albumData.length === 0) return;

      // Fetch songs that belong to these albums
      const albumIds = albumData.map(a => a.id);
      const { data: songData } = await supabase
        .from("songs")
        .select("*")
        .in("album_id", albumIds);

      const songsMap: Record<string, PlayerSong[]> = {};
      (songData || []).forEach(s => {
        if (!s.album_id) return;
        if (!songsMap[s.album_id]) songsMap[s.album_id] = [];
        songsMap[s.album_id].push({
          id: s.id, title: s.title, artist: s.artist, album: s.album || undefined,
          coverUrl: s.cover_url || undefined, audioUrl: s.audio_url || undefined,
          instrumentalUrl: s.instrumental_url || undefined, lyricsLrc: s.lyrics_lrc || undefined,
          durationSeconds: s.duration_seconds,
        });
      });

      setAlbums(albumData.map(a => ({
        id: a.id, title: a.title, artist: a.artist, cover_url: a.cover_url,
        songs: songsMap[a.id] || [],
      })));
    };
    fetchAlbums();
  }, []);

  if (albums.length === 0) return null;

  // Album detail view
  if (selectedAlbum) {
    return (
      <section className="px-4 lg:px-6 mt-8 animate-fade-in-up">
        <button onClick={() => setSelectedAlbum(null)} className="flex items-center gap-1 text-sm text-gold mb-4 hover:underline">
          <ChevronLeft className="w-4 h-4" /> Back to Albums
        </button>
        <div className="flex items-end gap-4 mb-6">
          <div className="w-28 h-28 rounded-xl gradient-purple flex-shrink-0 overflow-hidden flex items-center justify-center glow-gold">
            {selectedAlbum.cover_url ? (
              <img src={selectedAlbum.cover_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <Disc3 className="w-10 h-10 text-gold/30" />
            )}
          </div>
          <div>
            <h3 className="text-xl font-serif font-bold text-foreground">{selectedAlbum.title}</h3>
            <p className="text-sm text-muted-foreground">{selectedAlbum.artist} • {selectedAlbum.songs.length} songs</p>
            <button
              onClick={() => playQueue(selectedAlbum.songs)}
              className="mt-2 px-4 py-1.5 rounded-full gradient-gold text-primary-foreground text-xs font-semibold"
            >
              Play All
            </button>
          </div>
        </div>
        <div className="space-y-1">
          {selectedAlbum.songs.map((song, i) => {
            const isActive = currentSong?.id === song.id;
            return (
              <button
                key={song.id}
                onClick={() => playQueue(selectedAlbum.songs, i)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive ? "bg-gold/10" : "hover:bg-muted/40"}`}
              >
                <span className="w-6 text-xs text-muted-foreground text-right">
                  {isActive && isPlaying ? (
                    <span className="flex gap-0.5 justify-end">
                      <span className="w-0.5 h-3 bg-gold rounded-full animate-pulse" />
                      <span className="w-0.5 h-3 bg-gold rounded-full animate-pulse" style={{ animationDelay: "0.15s" }} />
                      <span className="w-0.5 h-3 bg-gold rounded-full animate-pulse" style={{ animationDelay: "0.3s" }} />
                    </span>
                  ) : (
                    i + 1
                  )}
                </span>
                <div className="flex-1 text-left min-w-0">
                  <p className={`text-sm truncate ${isActive ? "text-gold font-medium" : "text-foreground"}`}>{song.title}</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {Math.floor((song.durationSeconds || 0) / 60)}:{((song.durationSeconds || 0) % 60).toString().padStart(2, "0")}
                </span>
              </button>
            );
          })}
          {selectedAlbum.songs.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">No songs in this album yet.</p>
          )}
        </div>
      </section>
    );
  }

  // Album grid view
  return (
    <section className="px-4 lg:px-6 mt-8 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-serif font-bold text-foreground">Top Albums</h3>
        <button onClick={() => navigate("/albums")} className="text-xs text-gold hover:text-gold-light font-medium transition-colors duration-200">See All</button>
      </div>
      <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-1 px-1">
        {albums.map((album, i) => (
          <button
            key={album.id}
            onClick={() => setSelectedAlbum(album)}
            className="group flex-shrink-0 w-40 md:w-44 text-left animate-fade-in-up"
            style={{ animationDelay: `${i * 0.07}s` }}
          >
            <div className="relative aspect-square rounded-xl overflow-hidden mb-3 glass-card transition-all duration-300 group-hover:shadow-[0_8px_32px_hsl(43_70%_53%/0.12)]">
              {album.cover_url ? (
                <img src={album.cover_url} alt={album.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
              ) : (
                <div className="w-full h-full gradient-purple flex items-center justify-center">
                  <Disc3 className="w-10 h-10 text-gold/30" />
                </div>
              )}
              <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-10 h-10 rounded-full gradient-gold flex items-center justify-center shadow-lg">
                  <Play className="w-4 h-4 text-primary-foreground ml-0.5" />
                </div>
              </div>
            </div>
            <p className="text-sm font-medium text-foreground truncate group-hover:text-gold transition-colors duration-200">{album.title}</p>
            <p className="text-xs text-muted-foreground truncate">{album.artist} • {album.songs.length} songs</p>
          </button>
        ))}
      </div>
    </section>
  );
};

export default AlbumSection;
