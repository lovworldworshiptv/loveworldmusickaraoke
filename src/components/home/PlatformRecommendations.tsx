import SeeAll from "./SeeAll";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ListMusic, Play } from "lucide-react";
import { cardGradient, useGlobalCardColor } from "@/lib/siteSettings";

type Rec = { id: string; name: string; description: string | null; card_color: string | null; cover_url: string | null; playlist_songs: { songs: { title: string; artist: string; cover_url: string | null } | null }[] | null };

/** Spotify-style recommendation cards; each opens the playlist's collection page. */

const PlatformRecommendations = () => {
  const [items, setItems] = useState<Rec[]>([]);
  const navigate = useNavigate();
  const globalColor = useGlobalCardColor();

  useEffect(() => {
    supabase.from("playlists")
      .select("id,name,description,cover_url,card_color,playlist_songs(songs(title,artist,cover_url))")
      .eq("is_visible_on_homepage", true)
      .order("created_at", { ascending: false }).limit(8)
      .then(({ data }) => setItems(((data as unknown as Rec[]) || []).filter((p) => (p.playlist_songs || []).some((s) => s.songs))));
  }, []);

  if (!items.length) return null;

  return (
    <section className="px-4 lg:px-6 mt-8 animate-fade-in-up" aria-labelledby="recs-h">
      <div className="flex items-end justify-between gap-3 mb-4"><div>
      <p className="text-[11px] uppercase tracking-[0.2em] text-gold/80">Curated for you</p>
      <h3 id="recs-h" className="text-xl font-serif font-bold text-foreground">Recommended Playlists</h3>
      </div><SeeAll to="/playlists" /></div>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2 touch-pan-x overscroll-x-contain">
        {items.map((p) => {
          const songs = (p.playlist_songs || []).map((s) => s.songs).filter(Boolean) as NonNullable<Rec["playlist_songs"]>[number]["songs"][];
          const cover = p.cover_url || songs[0]?.cover_url;
          const names = songs.slice(0, 3).map((s) => s!.title).join(", ");
          const color = p.card_color || globalColor;
          const tint = cardGradient(color);
          return (
            <button key={p.id} onClick={() => navigate(`/collection/${p.id}?color=${encodeURIComponent(color)}`)}
              className={`snap-start flex-shrink-0 w-full md:w-[calc(50%_-_0.375rem)] lg:w-[29.6%] h-[199px] md:h-[173px] rounded-2xl p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${tint ? "border-0 shadow-lg" : "glass-card hover:border-gold/40"}`}
              style={tint ? { background: tint } : undefined}>
              <div className="flex h-full gap-3">
                <div className="aspect-square h-[88px] md:h-[73px] rounded-xl overflow-hidden flex-shrink-0 bg-muted">
                  {cover ? <img src={cover} alt="" loading="lazy" className="w-full h-full object-cover" /> :
                    <div className="w-full h-full gradient-purple flex items-center justify-center"><ListMusic className="w-8 h-8 text-gold/60" /></div>}
                </div>
                <div className="min-w-0 flex-1 flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-white/90">Playlist · {songs.length} songs</span>
                  <p className="font-serif font-bold text-white truncate mt-0.5">{p.name}</p>
                  <p className="text-xs text-white line-clamp-2 mt-1">{p.description?.trim() || names}</p>
                  <span className="mt-auto self-end w-9 h-9 rounded-full gradient-gold flex items-center justify-center shadow-[0_2px_12px_hsl(var(--gold)/0.4)]">
                    <Play className="w-4 h-4 text-white ml-0.5" fill="currentColor" />
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default PlatformRecommendations;
