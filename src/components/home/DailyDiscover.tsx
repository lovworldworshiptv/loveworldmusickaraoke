import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer } from "@/contexts/PlayerContext";
import { fetchSongsByIds, toPlayerSong, type SongRow } from "@/lib/homeSongs";
import { Play, Sparkles, Mic2 } from "lucide-react";

/** Once-a-day personal pick with ambient artwork background. */
const DailyDiscover = () => {
  const [song, setSong] = useState<SongRow | null>(null);
  const [reason, setReason] = useState("");
  const { playSong, toggleKaraoke, isKaraoke } = usePlayer();

  useEffect(() => {
    supabase.rpc("get_daily_discover").then(async ({ data }) => {
      const row = (data as { song_id: string; reason: string }[] | null)?.[0];
      if (!row) return;
      const [s] = await fetchSongsByIds([row.song_id]);
      if (s) { setSong(s); setReason(row.reason); }
    });
  }, []);

  if (!song) return null;

  const play = (karaoke: boolean) => {
    playSong(toPlayerSong(song));
    if (karaoke !== isKaraoke && song.instrumental_url) setTimeout(() => toggleKaraoke(), 300);
  };

  return (
    <section className="px-4 lg:px-6 mt-8 animate-fade-in-up" aria-label="Daily Discover">
      <div className="relative overflow-hidden rounded-2xl border border-gold/30 shadow-[0_8px_40px_hsl(43_70%_53%/0.15)]">
        {song.cover_url && (
          <img src={song.cover_url} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover scale-125 blur-2xl opacity-50" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/40" />
        <div className="relative flex items-center gap-4 p-4 md:p-6">
          <div className="w-24 h-24 md:w-32 md:h-32 rounded-xl overflow-hidden flex-shrink-0 ring-1 ring-gold/40">
            {song.cover_url ? <img src={song.cover_url} alt={song.title} className="w-full h-full object-cover" /> : <div className="w-full h-full gradient-purple" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-gold"><Sparkles className="w-3.5 h-3.5" /> Daily Discover</p>
            <h3 className="mt-1 text-lg md:text-2xl font-serif font-bold text-foreground truncate">{song.title}</h3>
            <p className="text-xs md:text-sm text-muted-foreground truncate">{reason}</p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => play(false)} className="gradient-gold text-primary-foreground rounded-full px-4 py-2 text-xs font-semibold flex items-center gap-1.5 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
                <Play className="w-3.5 h-3.5" fill="currentColor" /> Play
              </button>
              {song.instrumental_url && (
                <button onClick={() => play(true)} className="glass border border-gold/40 text-foreground rounded-full px-4 py-2 text-xs font-semibold flex items-center gap-1.5 active:scale-95 hover:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
                  <Mic2 className="w-3.5 h-3.5 text-gold" /> Sing
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DailyDiscover;
