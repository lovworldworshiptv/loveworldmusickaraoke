import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SONG_COLUMNS, toPlayerSong, type SongRow } from "@/lib/homeSongs";
import { sectionText, type HomeSectionContent } from "@/lib/homeSections";
import { SETTING_KEYS, useSetting } from "@/lib/siteSettings";
import type { PlayerSong } from "@/contexts/PlayerContext";
import SongCard from "./SongCard";

/** Home rail listing every song marked free to download. */
const FreeDownloads = () => {
  const [songs, setSongs] = useState<PlayerSong[]>([]);
  const text = sectionText(useSetting<HomeSectionContent>(SETTING_KEYS.homeSectionContent), "free_downloads");
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.from("songs").select(SONG_COLUMNS).eq("is_free_download", true).order("title").order("id").limit(100)
      .then(({ data }) => setSongs(((data as SongRow[] | null) || []).map(toPlayerSong)));
  }, []);

  if (!songs.length) return null;
  const scroll = (dir: number) => scrollRef.current?.scrollBy({ left: dir * scrollRef.current.clientWidth * 0.6, behavior: "smooth" });

  return (
    <section className="px-4 lg:px-6 mt-8 animate-fade-in-up">
      <div className="flex items-end justify-between mb-4">
        <div>
          {text.eyebrow && <p className="text-xs uppercase tracking-widest text-gold">{text.eyebrow}</p>}
          <h3 className="text-xl font-serif font-bold text-foreground">{text.title}</h3>
        </div>
        <div className="flex items-center gap-2">
          <button aria-label="Scroll left" onClick={() => scroll(-1)} className="hidden lg:flex w-8 h-8 rounded-full items-center justify-center bg-muted text-foreground"><ChevronLeft className="w-4 h-4" /></button>
          <button aria-label="Scroll right" onClick={() => scroll(1)} className="hidden lg:flex w-8 h-8 rounded-full items-center justify-center bg-muted text-foreground"><ChevronRight className="w-4 h-4" /></button>
          <button onClick={() => navigate("/library")} className="text-xs text-gold font-medium">See All</button>
        </div>
      </div>
      <div ref={scrollRef} className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-1 px-1">
        {songs.map((song, i) => <SongCard key={song.id} song={song} index={i} allSongs={songs} />)}
      </div>
    </section>
  );
};

export default FreeDownloads;
