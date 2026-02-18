import { useParams, useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { usePlayer, type PlayerSong } from "@/contexts/PlayerContext";
import { Music, ArrowLeft, Play, Pause, Shuffle, ListMusic } from "lucide-react";
import { useMemo } from "react";

const CategorySongs = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { playSong, playQueue, currentSong, isPlaying } = usePlayer();

  const { data: category } = useQuery({
    queryKey: ["category", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("id, name, image_url").eq("id", id!).single();
      return data;
    },
  });

  const { data: songs = [], isLoading } = useQuery({
    queryKey: ["category-songs", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("songs")
        .select("*")
        .eq("category_id", id!)
        .order("title");
      return data || [];
    },
  });

  const playerSongs = useMemo(() => songs.map((s: any): PlayerSong => ({
    id: s.id, title: s.title, artist: s.artist, album: s.album || undefined,
    coverUrl: s.cover_url || undefined, audioUrl: s.audio_url || undefined,
    instrumentalUrl: s.instrumental_url || undefined, lyricsLrc: s.lyrics_lrc || undefined,
    durationSeconds: s.duration_seconds,
  })), [songs]);

  const handlePlayAll = () => {
    if (playerSongs.length > 0) playQueue(playerSongs, 0);
  };

  const handleShuffle = () => {
    if (playerSongs.length > 0) {
      const shuffled = [...playerSongs].sort(() => Math.random() - 0.5);
      playQueue(shuffled, 0);
    }
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const totalDuration = useMemo(() => {
    const total = songs.reduce((acc: number, s: any) => acc + (s.duration_seconds || 0), 0);
    const hrs = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    return hrs > 0 ? `${hrs} hr ${mins} min` : `${mins} min`;
  }, [songs]);

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 lg:pt-6 max-w-2xl mx-auto pb-8">
        {/* Back button */}
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-5 transition-colors group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span className="text-sm font-medium">Back</span>
        </button>

        {/* Hero header */}
        {category && (
          <div className="relative rounded-2xl overflow-hidden mb-6 animate-fade-in">
            {/* Background image or gradient */}
            <div className="absolute inset-0">
              {category.image_url ? (
                <>
                  <img src={category.image_url} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/30" />
                </>
              ) : (
                <div className="w-full h-full gradient-purple opacity-40" />
              )}
            </div>

            <div className="relative z-10 p-6 pt-12 pb-5 flex flex-col items-center text-center">
              {category.image_url ? (
                <img
                  src={category.image_url}
                  alt={category.name}
                  className="w-24 h-24 rounded-2xl object-cover border-2 border-primary/30 shadow-[0_8px_32px_hsl(43_70%_53%/0.2)] mb-4"
                />
              ) : (
                <div className="w-24 h-24 rounded-2xl gradient-purple flex items-center justify-center border-2 border-primary/30 shadow-[0_8px_32px_hsl(43_70%_53%/0.2)] mb-4">
                  <Music className="w-10 h-10 text-primary" />
                </div>
              )}
              <h1 className="text-2xl md:text-3xl font-serif font-bold text-foreground mb-1">{category.name}</h1>
              <p className="text-sm text-muted-foreground">
                {songs.length} song{songs.length !== 1 ? "s" : ""} • {totalDuration}
              </p>
            </div>
          </div>
        )}

        {/* Action buttons */}
        {songs.length > 0 && (
          <div className="flex items-center gap-3 mb-5 animate-fade-in" style={{ animationDelay: "0.1s" }}>
            <button
              onClick={handlePlayAll}
              className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-semibold text-sm shadow-[0_4px_20px_hsl(43_70%_53%/0.35)] hover:shadow-[0_6px_28px_hsl(43_70%_53%/0.5)] active:scale-[0.98] transition-all duration-200"
            >
              <Play className="w-5 h-5" fill="currentColor" />
              Play All
            </button>
            <button
              onClick={handleShuffle}
              className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl glass-card border border-border/50 text-foreground font-semibold text-sm hover:bg-muted/60 active:scale-[0.98] transition-all duration-200"
            >
              <Shuffle className="w-5 h-5 text-primary" />
              Shuffle
            </button>
          </div>
        )}

        {/* Song list */}
        {isLoading ? (
          <div className="space-y-3 py-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl animate-pulse">
                <div className="w-12 h-12 rounded-lg bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-muted rounded w-2/3" />
                  <div className="h-3 bg-muted rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : songs.length === 0 ? (
          <div className="text-center py-16 animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <ListMusic className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground font-medium">No songs in this category yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Songs added to this category will appear here</p>
          </div>
        ) : (
          <div className="space-y-1">
            {songs.map((song: any, index: number) => {
              const isActive = currentSong?.id === song.id;
              return (
                <button
                  key={song.id}
                  onClick={() => playQueue(playerSongs, index)}
                  className={`group flex items-center gap-3 w-full p-3 rounded-xl transition-all duration-200 hover:bg-muted/60 animate-fade-in ${
                    isActive ? "bg-muted/80 ring-1 ring-primary/50" : ""
                  }`}
                  style={{ animationDelay: `${Math.min(index * 0.03, 0.5)}s` }}
                >
                  {/* Track number / cover */}
                  <div className="relative flex-shrink-0">
                    {song.cover_url ? (
                      <img src={song.cover_url} alt={song.title} className="w-12 h-12 rounded-lg object-cover" loading="lazy" decoding="async" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Music className="w-5 h-5 text-primary/50" />
                      </div>
                    )}
                    {/* Hover play overlay */}
                    <div className="absolute inset-0 rounded-lg bg-background/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      {isActive && isPlaying ? (
                        <Pause className="w-5 h-5 text-primary" fill="currentColor" />
                      ) : (
                        <Play className="w-5 h-5 text-primary ml-0.5" fill="currentColor" />
                      )}
                    </div>
                  </div>

                  {/* Song info */}
                  <div className="flex-1 min-w-0 text-left">
                    <p className={`text-sm font-medium truncate transition-colors ${isActive ? "text-primary" : "text-foreground"}`}>
                      {song.title}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                  </div>

                  {/* Duration / equalizer */}
                  {isActive && isPlaying ? (
                    <div className="flex gap-[3px] items-end h-4 mr-1">
                      <div className="w-[3px] h-2 bg-primary rounded-full animate-pulse" />
                      <div className="w-[3px] h-3.5 bg-primary rounded-full animate-pulse" style={{ animationDelay: "0.15s" }} />
                      <div className="w-[3px] h-2.5 bg-primary rounded-full animate-pulse" style={{ animationDelay: "0.3s" }} />
                      <div className="w-[3px] h-4 bg-primary rounded-full animate-pulse" style={{ animationDelay: "0.45s" }} />
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground tabular-nums mr-1">
                      {formatDuration(song.duration_seconds)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default CategorySongs;
