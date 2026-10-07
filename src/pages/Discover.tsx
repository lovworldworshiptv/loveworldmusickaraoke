import { useState, useMemo } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Search, BookOpen, Music2, Gamepad2, Music, ArrowDownAZ, ArrowUpZA, Bell, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { usePlayer, type PlayerSong } from "@/contexts/PlayerContext";
import { sortSongsByTitle } from "@/lib/utils";
import FeaturedCarousel from "@/components/discover/FeaturedCarousel";
import CategoryTile from "@/components/discover/CategoryTile";
import type { DiscoverCategory, DiscoverFeatured } from "@/lib/discover";

const Discover = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [sortAZ, setSortAZ] = useState(false);
  const { playSong } = usePlayer();

  const { data: songResults = [] } = useQuery({
    queryKey: ["discover-songs", search],
    enabled: search.trim().length >= 2,
    queryFn: async () => {
      const { data } = await supabase
        .from("songs")
        .select("*")
        .or(`title.ilike.%${search}%,artist.ilike.%${search}%,lyrics_lrc.ilike.%${search}%`)
        .limit(20);
      return data || [];
    },
  });

  const sortedSongs = useMemo(() => {
    return sortSongsByTitle(songResults as any[]);
  }, [songResults, sortAZ]);

  const { data: articleResults = [] } = useQuery({
    queryKey: ["discover-articles", search],
    enabled: search.trim().length >= 2,
    queryFn: async () => {
      const { data } = await supabase
        .from("articles")
        .select("id, title, author, category")
        .eq("is_published", true)
        .or(`title.ilike.%${search}%,author.ilike.%${search}%`)
        .limit(5);
      return data || [];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["discover-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("discover_categories").select("*").eq("is_visible", true).order("sort_order");
      return (data || []) as DiscoverCategory[];
    },
  });
  const { data: featured = [] } = useQuery({
    queryKey: ["discover-featured"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data } = await supabase.from("discover_featured").select("*").eq("is_active", true).order("sort_order");
      return ((data || []) as DiscoverFeatured[]).filter((f) => (!f.starts_at || f.starts_at <= now) && (!f.ends_at || f.ends_at > now));
    },
  });

  const hasResults = search.trim().length >= 2 && (songResults.length > 0 || articleResults.length > 0);

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 lg:pt-6 max-w-6xl mx-auto pb-16 lg:pb-20">
        <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-1">Discover</h1>
        <p className="text-sm text-foreground/80 mb-4">Music, karaoke, videos and more — all in one place.</p>

        {/* Search */}
        <div className="relative mb-6 max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-background/70" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search songs, lyrics, articles..."
            className="w-full pl-12 pr-4 py-3.5 rounded-[14px] bg-foreground/95 text-sm text-background placeholder:text-background/60 focus:outline-none focus:ring-2 focus:ring-gold focus:scale-[1.01] transition-all"
          />
        </div>

        {/* Search Results */}
        {hasResults && (
          <div className="mb-6 space-y-4">
            {sortedSongs.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-muted-foreground">Songs</h3>
                  <button
                    onClick={() => setSortAZ((v) => !v)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    title={sortAZ ? "Sort by relevance" : "Sort A-Z"}
                  >
                    {sortAZ ? <ArrowUpZA className="w-3.5 h-3.5" /> : <ArrowDownAZ className="w-3.5 h-3.5" />}
                    {sortAZ ? "A-Z" : "Sort"}
                  </button>
                </div>
                <div className="space-y-1">
                  {sortedSongs.map((s: any) => {
                    const lyricsMatch = s.lyrics_lrc && search.trim().length >= 2 &&
                      s.lyrics_lrc.toLowerCase().includes(search.toLowerCase()) &&
                      !s.title.toLowerCase().includes(search.toLowerCase()) &&
                      !s.artist.toLowerCase().includes(search.toLowerCase());
                    return (
                      <button
                        key={s.id}
                        onClick={() => playSong({
                          id: s.id, title: s.title, artist: s.artist, album: s.album || undefined,
                          coverUrl: s.cover_url || undefined, audioUrl: s.audio_url || undefined,
                          instrumentalUrl: s.instrumental_url || undefined, lyricsLrc: s.lyrics_lrc || undefined,
                          durationSeconds: s.duration_seconds,
                        })}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/40 transition-colors text-left"
                      >
                        <div className="w-10 h-10 rounded bg-primary/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {s.cover_url ? <img src={s.cover_url} alt="" className="w-full h-full object-cover" /> : <Music className="w-4 h-4 text-primary" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-foreground truncate">{s.title}</p>
                          <p className="text-xs text-foreground truncate">
                            {s.artist}
                            {lyricsMatch && <span className="ml-1 text-primary">• lyrics match</span>}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {articleResults.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Articles</h3>
                <div className="space-y-1">
                  {articleResults.map((a: any) => (
                    <button
                      key={a.id}
                      onClick={() => navigate(`/articles?id=${a.id}`)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/40 transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded bg-gold/10 flex items-center justify-center flex-shrink-0">
                        <BookOpen className="w-4 h-4 text-gold" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-foreground truncate">{a.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{a.author} • {a.category}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {search.trim().length >= 2 && !hasResults && (
          <p className="text-sm text-muted-foreground text-center py-4 mb-4">No results found for "{search}"</p>
        )}

        {featured.length > 0 && (
          <section className="mb-6">
            <h2 className="text-xl font-serif font-bold text-foreground mb-3">Featured</h2>
            <FeaturedCarousel items={featured} />
          </section>
        )}

        <section>
          <h2 className="text-xl font-serif font-bold text-foreground mb-3">Browse all</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {categories.map((c) => <CategoryTile key={c.id} c={c} />)}
          </div>
        </section>
      </div>
      <div className="h-8" />
    </AppLayout>
  );
};

export default Discover;
