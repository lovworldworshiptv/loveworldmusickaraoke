import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer } from "@/contexts/PlayerContext";
import { fetchSongsByIds, toPlayerSong, type SongRow } from "@/lib/homeSongs";
import { Play, Sparkles, Mic2 } from "lucide-react";
import { useDominantColor } from "@/lib/dominantColor";

/** Once-a-day personal pick with ambient artwork background. */
const DailyDiscover = () => {
  const [song, setSong] = useState<SongRow | null>(null);
  const [reason, setReason] = useState("");
  const { playSong, toggleKaraoke, isKaraoke } = usePlayer();
  const dominant = useDominantColor(song?.cover_url);

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
      <div
        role="button"
        tabIndex={0}
        aria-label={`Play ${song.title}`}
        onClick={() => play(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); play(false); }
        }}
        className="relative overflow-hidden rounded-2xl p-3 text-left cursor-pointer transition-transform duration-300 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold h-[166px] md:h-36"
        style={{
          boxShadow: dominant
            ? `0 8px 40px rgba(${dominant[0]}, ${dominant[1]}, ${dominant[2]}, 0.35)`
            : "0 8px 40px hsl(43 70% 53% / 0.15)",
          background: "linear-gradient(120deg, hsl(43 100% 60%) 0%, hsl(320 95% 52%) 55%, hsl(265 90% 55%) 100%)",
        }}
      >
        {song.cover_url && (
          <img src={song.cover_url} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover scale-125 blur-2xl opacity-30 mix-blend-luminosity" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/60 to-transparent" />
        <div className="relative flex h-full gap-3">
          <div className="aspect-square h-full rounded-xl overflow-hidden flex-shrink-0 bg-muted ring-1 ring-gold/40">
            {song.cover_url ? <img src={song.cover_url} alt={song.title} className="w-full h-full object-cover" /> : <div className="w-full h-full gradient-purple flex items-center justify-center"><Sparkles className="w-8 h-8 text-gold/60" /></div>}
          </div>
          <div className="min-w-0 flex-1 flex flex-col">
            <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-gold"><Sparkles className="w-3 h-3" /> Daily Discover</span>
            <p className="font-serif font-bold text-foreground truncate mt-0.5">{song.title}</p>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{reason}</p>
            <div className="mt-auto self-end flex items-center gap-2">
              {song.instrumental_url && (
                <button
                  onClick={(e) => { e.stopPropagation(); play(true); }}
                  aria-label="Sing in karaoke mode"
                  className="w-9 h-9 rounded-full glass border border-gold/40 flex items-center justify-center active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                >
                  <Mic2 className="w-4 h-4 text-gold" />
                </button>
              )}
              <span className="w-9 h-9 rounded-full gradient-gold flex items-center justify-center shadow-[0_2px_12px_hsl(var(--gold)/0.4)]">
                <Play className="w-4 h-4 text-white ml-0.5" fill="currentColor" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DailyDiscover;
