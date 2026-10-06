import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer } from "@/contexts/PlayerContext";
import { fetchSongsByIds, toPlayerSong, type SongRow } from "@/lib/homeSongs";
import { Play, Pause, Music2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props { moodId: string | null; moodName?: string }

/** 4-row snap carousel of quick-play songs (recent + trending + featured). */
const QuickPicks = ({ moodId, moodName }: Props) => {
  const [songs, setSongs] = useState<SongRow[]>([]);
  const { playQueue, currentSong, isPlaying, togglePlay } = usePlayer();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let rows: SongRow[] = [];
      if (moodId) {
        const { data } = await supabase.from("songs")
          .select("id,title,artist,album,cover_url,audio_url,instrumental_url,lyrics_lrc,duration_seconds,category_id")
          .eq("category_id", moodId).order("play_count", { ascending: false }).limit(16);
        rows = (data as SongRow[]) || [];
      } else {
        const { data } = await supabase.rpc("get_quick_picks", { p_limit: 16 });
        rows = await fetchSongsByIds(((data as { song_id: string }[]) || []).map((r) => r.song_id));
      }
      if (!cancelled) setSongs(rows.filter((s) => s.audio_url));
    })();
    return () => { cancelled = true; };
  }, [moodId]);

  const columns = useMemo(() => {
    const cols: SongRow[][] = [];
    for (let i = 0; i < songs.length; i += 4) cols.push(songs.slice(i, i + 4));
    return cols;
  }, [songs]);

  if (!songs.length) return null;
  const queue = songs.map(toPlayerSong);

  return (
    <section className="px-4 lg:px-6 mt-8 animate-fade-in-up" aria-labelledby="quick-picks-h">
      <div className="mb-4">
        <p className="text-[11px] uppercase tracking-[0.2em] text-gold/80">{moodName ? moodName : "Start singing"}</p>
        <h3 id="quick-picks-h" className="text-xl font-serif font-bold text-foreground">Quick Picks</h3>
      </div>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2 -mx-1 px-1 touch-pan-x overscroll-x-contain" style={{ WebkitOverflowScrolling: "touch" }}>
        {columns.map((col, ci) => (
          <div key={ci} className="snap-start flex-shrink-0 w-[85%] sm:w-[48%] lg:w-[32%] flex flex-col gap-2">
            {col.map((s) => {
              const idx = songs.indexOf(s);
              const active = currentSong?.id === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => (active ? togglePlay() : playQueue(queue, idx))}
                  aria-label={`${active && isPlaying ? "Pause" : "Play"} ${s.title}`}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl p-2 text-left transition-colors glass-card hover:border-gold/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
                    active && "border-gold/60"
                  )}
                >
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                    {s.cover_url ? (
                      <img src={s.cover_url} alt="" loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full gradient-purple flex items-center justify-center"><Music2 className="w-5 h-5 text-gold/50" /></div>
                    )}
                    <div className={cn("absolute inset-0 flex items-center justify-center bg-background/50 transition-opacity", active ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
                      {active && isPlaying ? <Pause className="w-4 h-4 text-gold" fill="currentColor" /> : <Play className="w-4 h-4 text-gold" fill="currentColor" />}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm font-medium truncate", active ? "text-gold" : "text-foreground")}>{s.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{s.artist}</p>
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
};

export default QuickPicks;
