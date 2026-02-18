import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayer, type PlayerSong } from "@/contexts/PlayerContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Clock, Play, Music, Trash2 } from "lucide-react";
import { SongRowSkeleton, EmptyState } from "@/components/ui/loading-skeleton";
import { toast } from "sonner";

const History = () => {
  const { user } = useAuth();
  const { playSong, currentSong, isPlaying } = usePlayer();

  const { data: history = [], isLoading, refetch } = useQuery({
    queryKey: ["recently-played", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recently_played")
        .select("id, played_at, song_id, songs(id, title, artist, cover_url, audio_url, instrumental_url, lyrics_lrc, duration_seconds, album)")
        .eq("user_id", user!.id)
        .order("played_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as any[];
    },
  });

  const clearHistory = async () => {
    if (!user) return;
    await supabase.from("recently_played").delete().eq("user_id", user.id);
    toast.success("History cleared");
    refetch();
  };

  const toPlayerSong = (s: any): PlayerSong => ({
    id: s.id, title: s.title, artist: s.artist, album: s.album || undefined,
    coverUrl: s.cover_url || undefined, audioUrl: s.audio_url || undefined,
    instrumentalUrl: s.instrumental_url || undefined, lyricsLrc: s.lyrics_lrc || undefined,
    durationSeconds: s.duration_seconds,
  });

  const formatDuration = (sec: number) => `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, "0")}`;

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 lg:pt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-serif font-bold text-foreground">History</h2>
          {history.length > 0 && (
            <button onClick={clearHistory} className="text-xs text-destructive hover:underline flex items-center gap-1">
              <Trash2 className="w-3 h-3" /> Clear
            </button>
          )}
        </div>

        {!user ? (
          <EmptyState icon={Clock} title="Sign in to see your history" description="Your listening history will appear here" />
        ) : isLoading ? (
          <div className="space-y-1">{Array.from({ length: 6 }).map((_, i) => <SongRowSkeleton key={i} />)}</div>
        ) : history.length === 0 ? (
          <EmptyState icon={Clock} title="No history yet" description="Songs you play will appear here" />
        ) : (
          <div className="space-y-1">
            {history.map((item: any) => {
              const song = item.songs;
              if (!song) return null;
              const isActive = currentSong?.id === song.id;
              return (
                <button
                  key={item.id}
                  onClick={() => playSong(toPlayerSong(song))}
                  className={`flex items-center gap-3 w-full p-3 rounded-xl transition-all duration-200 active:scale-[0.98] hover:bg-muted/60 ${isActive ? "bg-muted/80 ring-1 ring-primary" : ""}`}
                >
                  {song.cover_url ? (
                    <img src={song.cover_url} alt={song.title} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" loading="lazy" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <Music className="w-5 h-5 text-primary" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium text-foreground truncate">{song.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{song.artist} • {formatDuration(song.duration_seconds)}</p>
                  </div>
                  {isActive && isPlaying ? (
                    <div className="flex gap-0.5 items-end h-4">
                      <div className="w-0.5 h-2 bg-gold rounded-full animate-pulse" />
                      <div className="w-0.5 h-3 bg-gold rounded-full animate-pulse" style={{ animationDelay: "0.15s" }} />
                      <div className="w-0.5 h-4 bg-gold rounded-full animate-pulse" style={{ animationDelay: "0.3s" }} />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold via-gold-light to-gold flex items-center justify-center shadow-[0_2px_12px_hsl(43_70%_53%/0.4)] ring-1 ring-white/20">
                      <Play className="w-3.5 h-3.5 text-primary-foreground ml-0.5 drop-shadow-sm" fill="currentColor" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div className="h-8" />
    </AppLayout>
  );
};

export default History;
