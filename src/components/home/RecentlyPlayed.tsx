import { Clock, Play, Music } from "lucide-react";
import { usePlayer, type PlayerSong } from "@/contexts/PlayerContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const RecentlyPlayed = () => {
  const { currentSong, isPlaying, playSong } = usePlayer();
  const { user } = useAuth();

  const { data: recentSongs = [] } = useQuery({
    queryKey: ["home-recently-played", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recently_played")
        .select("id, played_at, song_id, songs(id, title, artist, cover_url, audio_url, instrumental_url, lyrics_lrc, duration_seconds, album)")
        .eq("user_id", user!.id)
        .order("played_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      // Deduplicate by song_id, keep most recent
      const seen = new Set<string>();
      return (data || []).filter((item: any) => {
        if (!item.songs || seen.has(item.song_id)) return false;
        seen.add(item.song_id);
        return true;
      });
    },
    refetchInterval: 10000, // refresh periodically
  });

  const toPlayerSong = (s: any): PlayerSong => ({
    id: s.id, title: s.title, artist: s.artist, album: s.album || undefined,
    coverUrl: s.cover_url || undefined, audioUrl: s.audio_url || undefined,
    instrumentalUrl: s.instrumental_url || undefined, lyricsLrc: s.lyrics_lrc || undefined,
    durationSeconds: s.duration_seconds,
  });

  if (recentSongs.length === 0 && !currentSong) {
    return (
      <section className="px-4 lg:px-6 mt-8 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-serif font-bold text-foreground">Recently Played</h3>
        </div>
        <div className="glass-card p-8 text-center">
          <Clock className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Songs you listen to will appear here</p>
        </div>
      </section>
    );
  }

  const items = recentSongs.length > 0 ? recentSongs : (currentSong ? [{ id: "current", songs: { ...currentSong, cover_url: currentSong.coverUrl, audio_url: currentSong.audioUrl, instrumental_url: currentSong.instrumentalUrl, lyrics_lrc: currentSong.lyricsLrc, duration_seconds: currentSong.durationSeconds } }] : []);

  return (
    <section className="px-4 lg:px-6 mt-8 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-serif font-bold text-foreground">Recently Played</h3>
      </div>
      <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
        {items.map((item: any) => {
          const song = item.songs;
          if (!song) return null;
          const isActive = currentSong?.id === song.id;
          return (
            <button
              key={item.id}
              onClick={() => playSong(toPlayerSong(song))}
              className="flex-shrink-0 w-40 glass-card p-3 hover:glow-gold transition-all duration-300 text-left group hover:-translate-y-1"
            >
              <div className="w-full aspect-square rounded-xl gradient-purple flex items-center justify-center mb-3 relative overflow-hidden">
                {song.cover_url ? (
                  <img src={song.cover_url} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
                ) : (
                  <Music className="w-8 h-8 text-gold/40" />
                )}
                {isActive && isPlaying && (
                  <div className="absolute bottom-2 right-2 flex gap-0.5 items-end h-4">
                    <div className="w-0.5 h-2 bg-gold rounded-full animate-pulse" />
                    <div className="w-0.5 h-3 bg-gold rounded-full animate-pulse" style={{ animationDelay: "0.15s" }} />
                    <div className="w-0.5 h-4 bg-gold rounded-full animate-pulse" style={{ animationDelay: "0.3s" }} />
                  </div>
                )}
              </div>
              <p className="text-xs font-medium text-foreground truncate group-hover:text-gold transition-colors duration-200">{song.title}</p>
              <p className="text-[10px] text-muted-foreground truncate">{song.artist}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default RecentlyPlayed;
