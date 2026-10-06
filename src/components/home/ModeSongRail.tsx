import SeeAll from "./SeeAll";
import { getSetting, SETTING_KEYS } from "@/lib/siteSettings";
import { fetchSongsByIds } from "@/lib/homeSongs";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer } from "@/contexts/PlayerContext";
import { SONG_COLUMNS, toPlayerSong, type SongRow } from "@/lib/homeSongs";
import { Mic2, Music2, Video } from "lucide-react";

interface Props { mode: "video" | "karaoke"; eyebrow: string; title: string }

/** Swipeable rail that opens each song straight into Video or Karaoke mode. */
const ModeSongRail = ({ mode, eyebrow, title }: Props) => {
  const [songs, setSongs] = useState<SongRow[]>([]);
  const { playVideo, singThis } = usePlayer();

  useEffect(() => {
    let cancelled = false;
    getSetting<string[]>(mode === "video" ? SETTING_KEYS.curatedVideos : SETTING_KEYS.curatedKaraoke).then(async (ids) => {
      if (cancelled) return;
      if (ids && ids.length) { const rows = await fetchSongsByIds(ids); if (!cancelled && rows.length) { setSongs(rows as SongRow[]); return; } }
    const q = supabase.from("songs").select(SONG_COLUMNS).not("audio_url", "is", null);
    const filtered = mode === "video" ? q.eq("has_video", true) : q.not("instrumental_url", "is", null);
    filtered.order("play_count", { ascending: false }).limit(20).then(({ data }) => {
      const rows = ((data as SongRow[]) || []);
      // light daily shuffle so the list feels fresh each day
      const seed = new Date().getDate();
      setSongs(rows.map((r, i) => ({ r, k: (i * 7919 + seed * 31) % 97 })).sort((a, b) => a.k - b.k).map((x) => x.r).slice(0, 12));
    });
    });
    return () => { cancelled = true; };
  }, [mode]);

  if (!songs.length) return null;
  const Icon = mode === "video" ? Video : Mic2;

  return (
    <section className="px-4 lg:px-6 mt-8 animate-fade-in-up">
      <div className="flex items-end justify-between gap-3 mb-4"><div>
      <p className="text-[11px] uppercase tracking-[0.2em] text-gold/80">{eyebrow}</p>
      <h3 className="text-xl font-serif font-bold text-foreground">{title}</h3>
      </div><SeeAll to={mode === "video" ? "/videos" : "/discover"} /></div>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2 touch-pan-x overscroll-x-contain">
        {songs.map((s) => (
          <button key={s.id}
            onClick={() => (mode === "video" ? playVideo(toPlayerSong(s)) : singThis(toPlayerSong(s)))}
            aria-label={`${mode === "video" ? "Watch" : "Sing"} ${s.title}`}
            className={`snap-start flex-shrink-0 text-left group ${mode === "video" ? "w-[calc(80%-0.6rem)] md:w-[calc(44.4%_-_0.4rem)] lg:w-[29.6%]" : "w-36"}`}>
            <div className={`relative rounded-2xl overflow-hidden bg-muted ${mode === "video" ? "aspect-[16/10.8]" : "aspect-square"}`}>
              {s.cover_url ? <img src={s.cover_url} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" /> :
                <div className="w-full h-full gradient-purple flex items-center justify-center"><Music2 className="w-6 h-6 text-gold/50" /></div>}
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
              <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-background/70 backdrop-blur px-2 py-0.5 text-[10px] font-semibold text-gold">
                <Icon className="w-3 h-3" /> {mode === "video" ? "Video" : "Karaoke"}
              </span>
            </div>
            <p className="text-sm font-medium text-foreground truncate mt-2">{s.title}</p>
            <p className="text-xs text-foreground truncate">{s.artist}</p>
          </button>
        ))}
      </div>
    </section>
  );
};

export default ModeSongRail;
