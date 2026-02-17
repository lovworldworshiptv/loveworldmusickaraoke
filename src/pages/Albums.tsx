import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer, type PlayerSong } from "@/contexts/PlayerContext";
import { useQuery } from "@tanstack/react-query";
import { Disc3, Play, Shuffle, ChevronLeft, Music, Search } from "lucide-react";
import { SongRowSkeleton, EmptyState } from "@/components/ui/loading-skeleton";
import { useSearchParams } from "react-router-dom";

const Albums = () => {
  const { playSong, playQueue, currentSong, isPlaying } = usePlayer();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(searchParams.get("id"));
  const [search, setSearch] = useState("");

  const { data: albums = [], isLoading } = useQuery({
    queryKey: ["all-albums"],
    queryFn: async () => {
      const { data, error } = await supabase.from("albums").select("*").order("title");
      if (error) throw error;
      return data;
    },
  });

  const { data: albumSongs = [], isLoading: loadingSongs } = useQuery({
    queryKey: ["album-songs", selectedAlbumId],
    enabled: !!selectedAlbumId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("songs")
        .select("id, title, artist, cover_url, audio_url, instrumental_url, lyrics_lrc, duration_seconds, album")
        .eq("album_id", selectedAlbumId!)
        .order("title");
      if (error) throw error;
      return data;
    },
  });

  const toPlayerSong = (s: any): PlayerSong => ({
    id: s.id, title: s.title, artist: s.artist, album: s.album || undefined,
    coverUrl: s.cover_url || undefined, audioUrl: s.audio_url || undefined,
    instrumentalUrl: s.instrumental_url || undefined, lyricsLrc: s.lyrics_lrc || undefined,
    durationSeconds: s.duration_seconds,
  });

  const formatDuration = (sec: number) => `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, "0")}`;

  const selectedAlbum = albums.find(a => a.id === selectedAlbumId);

  // Sync URL param with state
  useEffect(() => {
    const urlId = searchParams.get("id");
    if (urlId && urlId !== selectedAlbumId) setSelectedAlbumId(urlId);
  }, [searchParams]);
  const playerSongs = albumSongs.map(toPlayerSong);

  const filteredAlbums = albums.filter(a =>
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    a.artist.toLowerCase().includes(search.toLowerCase())
  );

  // Album detail view
  if (selectedAlbum) {
    return (
      <AppLayout>
        <div className="px-4 lg:px-6 pt-4 lg:pt-6">
          <button onClick={() => { setSelectedAlbumId(null); setSearchParams({}); }} className="flex items-center gap-1 text-sm text-gold mb-4 hover:underline">
            <ChevronLeft className="w-4 h-4" /> All Albums
          </button>
          <div className="flex items-end gap-4 mb-6">
            <div className="w-32 h-32 rounded-xl overflow-hidden flex-shrink-0 glow-gold">
              {selectedAlbum.cover_url ? (
                <img src={selectedAlbum.cover_url} alt={selectedAlbum.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full gradient-purple flex items-center justify-center"><Disc3 className="w-10 h-10 text-gold/30" /></div>
              )}
            </div>
            <div>
              <h2 className="text-xl font-serif font-bold text-foreground">{selectedAlbum.title}</h2>
              <p className="text-sm text-muted-foreground">{selectedAlbum.artist} • {albumSongs.length} songs</p>
              <div className="flex gap-2 mt-3">
                <button onClick={() => playQueue(playerSongs)} className="px-4 py-2 rounded-full gradient-gold text-primary-foreground text-xs font-semibold flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5" /> Play All
                </button>
                <button onClick={() => { const shuffled = [...playerSongs].sort(() => Math.random() - 0.5); playQueue(shuffled); }}
                  className="px-4 py-2 rounded-full border border-border text-foreground text-xs font-semibold flex items-center gap-1.5 hover:bg-muted transition-colors">
                  <Shuffle className="w-3.5 h-3.5" /> Shuffle
                </button>
              </div>
            </div>
          </div>

          {loadingSongs ? (
            <div className="space-y-1">{Array.from({ length: 5 }).map((_, i) => <SongRowSkeleton key={i} />)}</div>
          ) : albumSongs.length === 0 ? (
            <EmptyState icon={Music} title="No songs yet" description="This album has no songs" />
          ) : (
            <div className="space-y-1">
              {albumSongs.map((song, i) => {
                const isActive = currentSong?.id === song.id;
                return (
                  <button key={song.id} onClick={() => playQueue(playerSongs, i)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors active:scale-[0.98] ${isActive ? "bg-gold/10" : "hover:bg-muted/40"}`}>
                    <span className="w-6 text-xs text-muted-foreground text-right">
                      {isActive && isPlaying ? (
                        <span className="flex gap-0.5 justify-end">
                          <span className="w-0.5 h-3 bg-gold rounded-full animate-pulse" />
                          <span className="w-0.5 h-3 bg-gold rounded-full animate-pulse" style={{ animationDelay: "0.15s" }} />
                          <span className="w-0.5 h-3 bg-gold rounded-full animate-pulse" style={{ animationDelay: "0.3s" }} />
                        </span>
                      ) : i + 1}
                    </span>
                    {song.cover_url ? (
                      <img src={song.cover_url} alt="" className="w-10 h-10 rounded object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-primary/20 flex items-center justify-center"><Music className="w-4 h-4 text-primary" /></div>
                    )}
                    <div className="flex-1 text-left min-w-0">
                      <p className={`text-sm truncate ${isActive ? "text-gold font-medium" : "text-foreground"}`}>{song.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDuration(song.duration_seconds)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="h-8" />
      </AppLayout>
    );
  }

  // Album grid
  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 lg:pt-6">
        <h2 className="text-2xl font-serif font-bold text-foreground mb-4">Albums</h2>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input type="text" placeholder="Search albums..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-square rounded-xl bg-muted mb-2" />
                <div className="h-3 bg-muted rounded w-3/4 mb-1" />
                <div className="h-2 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filteredAlbums.length === 0 ? (
          <EmptyState icon={Disc3} title="No albums found" description={search ? "Try a different search" : "No albums available"} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {filteredAlbums.map((album) => (
              <button key={album.id} onClick={() => { setSelectedAlbumId(album.id); setSearchParams({ id: album.id }); }}
                className="group text-left animate-fade-in-up">
                <div className="relative aspect-square rounded-xl overflow-hidden mb-2 glass-card transition-all duration-300 group-hover:shadow-[0_8px_32px_hsl(43_70%_53%/0.12)]">
                  {album.cover_url ? (
                    <img src={album.cover_url} alt={album.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                  ) : (
                    <div className="w-full h-full gradient-purple flex items-center justify-center"><Disc3 className="w-10 h-10 text-gold/30" /></div>
                  )}
                  <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-10 h-10 rounded-full gradient-gold flex items-center justify-center shadow-lg">
                      <Play className="w-4 h-4 text-primary-foreground ml-0.5" />
                    </div>
                  </div>
                </div>
                <p className="text-sm font-medium text-foreground truncate group-hover:text-gold transition-colors">{album.title}</p>
                <p className="text-xs text-muted-foreground truncate">{album.artist}</p>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="h-8" />
    </AppLayout>
  );
};

export default Albums;
