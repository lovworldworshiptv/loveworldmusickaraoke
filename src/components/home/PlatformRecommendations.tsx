import SeeAll from "./SeeAll";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ListMusic, Play } from "lucide-react";

type Rec = { id: string; name: string; cover_url: string | null; playlist_songs: { songs: { title: string; artist: string; cover_url: string | null } | null }[] | null };

/** Spotify-style recommendation cards; each opens the playlist's collection page. */
/** Deep brown treatment reserved for the "Pastor Chris Live Unending Praise" card. */
const isUnendingPraiseCard = (name: string) => /unending praise/i.test(name);

const PlatformRecommendations = () => {
  const [items, setItems] = useState<Rec[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.from("playlists")
      .select("id,name,cover_url,playlist_songs(songs(title,artist,cover_url))")
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
          const unendingPraise = isUnendingPraiseCard(p.name);
          return (
            <button key={p.id} onClick={() => navigate(`/collection/${p.id}`)}
              className={`snap-start flex-shrink-0 w-full md:w-[calc(50%_-_0.375rem)] lg:w-[29.6%] h-[166px] md:h-36 rounded-2xl p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${unendingPraise ? "border-0 shadow-[0_4px_20px_hsl(30_70%_25%/0.45)]" : "glass-card hover:border-gold/40"}`}
              style={unendingPraise ? { background: "linear-gradient(135deg, hsl(25 50% 10%) 0%, hsl(28 55% 24%) 55%, hsl(32 65% 38%) 100%)" } : undefined}>
              <div className="flex h-full gap-3">
                <div className="aspect-square h-full rounded-xl overflow-hidden flex-shrink-0 bg-muted">
                  {cover ? <img src={cover} alt="" loading="lazy" className="w-full h-full object-cover" /> :
                    <div className="w-full h-full gradient-purple flex items-center justify-center"><ListMusic className="w-8 h-8 text-gold/60" /></div>}
                </div>
                <div className="min-w-0 flex-1 flex flex-col">
                  <span className="text-[10px] uppercase tracking-wider text-gold">Playlist · {songs.length} songs</span>
                  <p className="font-serif font-bold text-foreground truncate mt-0.5">{p.name}</p>
                  <p className="text-xs text-white/90 line-clamp-2 mt-1">{names}</p>
                  <span className="mt-auto self-end w-9 h-9 rounded-full gradient-gold flex items-center justify-center shadow-[0_2px_12px_hsl(var(--gold)/0.4)]">
                    <Play className="w-4 h-4 text-primary-foreground ml-0.5" fill="currentColor" />
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
