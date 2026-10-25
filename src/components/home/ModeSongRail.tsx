import SeeAll from "./SeeAll";
import { getSetting, SETTING_KEYS, useSetting } from "@/lib/siteSettings";
import { curatedOrder, sectionText, type HomeSectionContent } from "@/lib/homeSections";
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
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const { playVideo, singThis } = usePlayer();
  const content = useSetting<HomeSectionContent>(SETTING_KEYS.homeSectionContent);
  const text = mode === "karaoke" ? sectionText(content, "karaoke") : { eyebrow, title };

  // Video cards prefer the video's own thumbnail; fall back to the song artwork.
  useEffect(() => {
    if (mode !== "video" || !songs.length) return;
    supabase.from("song_videos").select("song_id, thumbnail_url").in("song_id", songs.map((s) => s.id)).eq("is_active", true)
      .not("thumbnail_url", "is", null).then(({ data }) => {
        const map: Record<string, string> = {};
        (data || []).forEach((v) => { if (v.thumbnail_url && !map[v.song_id]) map[v.song_id] = v.thumbnail_url; });
        setThumbs(map);
      });
  }, [mode, songs]);

  useEffect(() => {
    let cancelled = false;
    getSetting<string[]>(mode === "video" ? SETTING_KEYS.curatedVideos : SETTING_KEYS.curatedKaraoke).then(async (ids) => {
      if (cancelled) return;
      if (ids && ids.length) { const rows = curatedOrder(await fetchSongsByIds(ids), ids).filter((r) => ids.includes(r.id)); if (!cancelled && rows.length) { setSongs(rows as SongRow[]); return; } }
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
      {text.eyebrow && <p className="text-[11px] uppercase tracking-[0.2em] text-gold/80">{text.eyebrow}</p>}
      <h3 className="text-xl font-serif font-bold text-foreground">{text.title}</h3>
      </div><SeeAll to={mode === "video" ? "/videos" : "/discover"} /></div>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2 touch-pan-x overscroll-x-contain">
        {songs.map((s, i) => (
          <button key={s.id}
            onClick={() => (mode === "video" ? playVideo(toPlayerSong(s)) : singThis(toPlayerSong(s)))}
            aria-label={`${mode === "video" ? "Watch" : "Sing"} ${s.title}`}
            className={`snap-start flex-shrink-0 text-left group active:scale-[0.97] transition-transform touch-manipulation ${mode === "video" ? "w-[calc(80%-0.6rem)] md:w-[calc(44.4%_-_0.4rem)] lg:w-[29.6%]" : "w-36"}`}>
            <div className={`relative rounded-2xl overflow-hidden bg-muted ${mode === "video" ? "aspect-[16/10.8]" : "aspect-square"}`}>
              {(thumbs[s.id] || s.cover_url) ? <>
                <img src={thumbs[s.id] || s.cover_url || ""} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover blur-xl scale-110 opacity-60" />
                <img src={thumbs[s.id] || s.cover_url || ""} alt="" loading={i < 3 ? "eager" : "lazy"} decoding="async" className="relative w-full h-full object-contain" />
              </> :
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
