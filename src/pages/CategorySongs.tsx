import { useParams, useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { usePlayer, type PlayerSong } from "@/contexts/PlayerContext";
import { Music, ArrowLeft, Play } from "lucide-react";

const CategorySongs = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { playSong, currentSong, isPlaying } = usePlayer();

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

  const toPlayerSong = (s: any): PlayerSong => ({
    id: s.id, title: s.title, artist: s.artist, album: s.album || undefined,
    coverUrl: s.cover_url || undefined, audioUrl: s.audio_url || undefined,
    instrumentalUrl: s.instrumental_url || undefined, lyricsLrc: s.lyrics_lrc || undefined,
    durationSeconds: s.duration_seconds,
  });

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 lg:pt-6 max-w-2xl mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back</span>
        </button>

        {category && (
          <div className="flex items-center gap-4 mb-6">
            {category.image_url ? (
              <img src={category.image_url} alt={category.name} className="w-16 h-16 rounded-full object-cover border-2 border-border" />
            ) : (
              <div className="w-16 h-16 rounded-full gradient-purple flex items-center justify-center border-2 border-border">
                <span className="text-xl font-serif text-gold">{category.name[0]}</span>
              </div>
            )}
            <div>
              <h1 className="text-2xl font-serif font-bold text-foreground">{category.name}</h1>
              <p className="text-sm text-muted-foreground">{songs.length} song{songs.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
        ) : songs.length === 0 ? (
          <div className="text-center py-12">
            <Music className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No songs in this category yet</p>
          </div>
        ) : (
          <div className="space-y-1">
            {songs.map((song: any) => (
              <button
                key={song.id}
                onClick={() => playSong(toPlayerSong(song))}
                className={`flex items-center gap-3 w-full p-3 rounded-xl transition-all duration-200 hover:bg-muted/60 ${
                  currentSong?.id === song.id ? "bg-muted/80 ring-1 ring-primary" : ""
                }`}
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
                {currentSong?.id === song.id && isPlaying ? (
                  <div className="flex gap-0.5 items-end h-4">
                    <div className="w-0.5 h-2 bg-gold rounded-full animate-pulse" />
                    <div className="w-0.5 h-3 bg-gold rounded-full animate-pulse" style={{ animationDelay: "0.15s" }} />
                    <div className="w-0.5 h-4 bg-gold rounded-full animate-pulse" style={{ animationDelay: "0.3s" }} />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold via-gold-light to-gold flex items-center justify-center shadow-[0_2px_12px_hsl(43_70%_53%/0.4)] ring-1 ring-white/20">
                    <Play className="w-3.5 h-3.5 text-white ml-0.5 drop-shadow-sm" fill="currentColor" />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="h-8" />
    </AppLayout>
  );
};

export default CategorySongs;
