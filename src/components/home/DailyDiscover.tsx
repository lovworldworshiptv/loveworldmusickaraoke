import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer } from "@/contexts/PlayerContext";
import { fetchSongsByIds, toPlayerSong, type SongRow } from "@/lib/homeSongs";
import { Play, Sparkles, Mic2 } from "lucide-react";
import { useDominantColor } from "@/lib/dominantColor";
import { useFeatures } from "@/contexts/FeatureContext";
import { useNavigate } from "react-router-dom";
import { cardGradient, getSetting, SETTING_KEYS, DEFAULT_DAILY_DISCOVER_COLOR, type DailyDiscoverConfig } from "@/lib/siteSettings";

/** Curated admin songs, else the algorithmic daily pick. */
export async function loadDailyDiscover() {
  const [cfg, ids] = await Promise.all([
    getSetting<DailyDiscoverConfig>(SETTING_KEYS.dailyDiscoverConfig),
    getSetting<string[]>(SETTING_KEYS.dailyDiscoverSongs),
  ]);
  let songs: SongRow[] = [];
  let reason = "";
  if (ids?.length) {
    const rows = await fetchSongsByIds(ids);
    songs = ids.map((id) => rows.find((r) => r.id === id)).filter(Boolean) as SongRow[];
  }
  if (!songs.length) {
    const { data } = await supabase.rpc("get_daily_discover");
    const row = (data as { song_id: string; reason: string }[] | null)?.[0];
    if (row) { songs = await fetchSongsByIds([row.song_id]); reason = row.reason; }
  }
  return { cfg: cfg || {}, songs, reason };
}

/** Once-a-day personal pick with ambient artwork background. */
const DailyDiscover = () => {
  const { enabled } = useFeatures();
  const [songs, setSongs] = useState<SongRow[]>([]);
  const [cfg, setCfg] = useState<DailyDiscoverConfig>({});
  const [reason, setReason] = useState("");
  const { playSong, playQueue, toggleKaraoke, isKaraoke } = usePlayer();
  const navigate = useNavigate();
  const song = songs[0] || null;
  const cover = cfg.coverUrl || song?.cover_url;
  const dominant = useDominantColor(cover);

  useEffect(() => {
    loadDailyDiscover().then((r) => { setSongs(r.songs); setCfg(r.cfg); setReason(r.reason); });
  }, []);

  if (!song) return null;

  const color = cfg.cardColor || DEFAULT_DAILY_DISCOVER_COLOR;
  const background = cfg.cardColor ? cardGradient(color) : "var(--daily-discover-background)";
  const desc = cfg.subtitle || reason || songs.slice(0, 3).map((s) => s.title).join(", ");
  const open = () => navigate(`/collection/daily-discover?color=${encodeURIComponent(color)}`);

  const play = (karaoke: boolean) => {
    if (!karaoke) { playQueue(songs.map(toPlayerSong)); return; }
    playSong(toPlayerSong(song));
    if (karaoke !== isKaraoke && song.instrumental_url) setTimeout(() => toggleKaraoke(), 300);
  };

  return (
    <section className="px-4 lg:px-6 mt-8 animate-fade-in-up" aria-label="Daily Discover">
      <div
        role="button"
        tabIndex={0}
        aria-label={`Open ${cfg.title || "Daily Discover"}`}
        onClick={open}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
        }}
        className="relative overflow-hidden rounded-2xl p-3 text-left cursor-pointer transition-transform duration-300 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold h-[199px] md:h-[173px]"
        style={{
          boxShadow: dominant
            ? `0 8px 40px rgba(${dominant[0]}, ${dominant[1]}, ${dominant[2]}, 0.35)`
            : "0 8px 40px hsl(43 70% 53% / 0.15)",
          background,
        }}
      >
        {cover && (
          <img src={cover} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover scale-125 blur-2xl opacity-30 mix-blend-luminosity" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-background/50 to-transparent" />
        <div className="relative flex h-full gap-3">
          <div className="aspect-square h-[88px] md:h-[73px] rounded-xl overflow-hidden flex-shrink-0 bg-muted ring-1 ring-gold/40">
            {cover ? <img src={cover} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full gradient-purple flex items-center justify-center"><Sparkles className="w-8 h-8 text-gold/60" /></div>}
          </div>
          <div className="min-w-0 flex-1 flex flex-col">
            <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-gold"><Sparkles className="w-3 h-3" /> Daily Discover · {songs.length} {songs.length === 1 ? "song" : "songs"}</span>
            <p className="font-serif font-bold text-foreground truncate mt-0.5">{cfg.title || song.title}</p>
            <p className="text-xs text-white line-clamp-2 mt-1">{desc}</p>
            <div className="mt-auto self-end flex items-center gap-2">
              {enabled("karaoke") && song.instrumental_url && (
                <button
                  onClick={(e) => { e.stopPropagation(); play(true); }}
                  aria-label="Sing in karaoke mode"
                  className="w-9 h-9 rounded-full glass border border-gold/40 flex items-center justify-center active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                >
                  <Mic2 className="w-4 h-4 text-gold" />
                </button>
              )}
              <button onClick={(e) => { e.stopPropagation(); play(false); }} aria-label="Play Daily Discover" className="w-9 h-9 rounded-full gradient-gold flex items-center justify-center shadow-[0_2px_12px_hsl(var(--gold)/0.4)]">
                <Play className="w-4 h-4 text-white ml-0.5" fill="currentColor" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DailyDiscover;
