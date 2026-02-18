import { useState, useMemo } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Search, BookOpen, Music2, Gamepad2, Music, ArrowDownAZ, ArrowUpZA } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { usePlayer, type PlayerSong } from "@/contexts/PlayerContext";

const tabs = [
  { id: "articles", label: "Articles", icon: BookOpen, path: "/articles" },
  { id: "music", label: "Music", icon: Music2, path: "/" },
  { id: "games", label: "Games", icon: Gamepad2, path: "/games" },
];

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
    if (!sortAZ) return songResults;
    return [...songResults].sort((a: any, b: any) => (a.title || "").localeCompare(b.title || ""));
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

  const hasResults = search.trim().length >= 2 && (songResults.length > 0 || articleResults.length > 0);

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 lg:pt-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-serif font-bold text-foreground mb-4">Discover</h1>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search songs, lyrics, articles..."
            className="w-full pl-11 pr-4 py-3 rounded-xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
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
                          <p className="text-xs text-muted-foreground truncate">
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

        {/* Category Cards */}
        <div className="grid gap-4">
          {tabs.map((tab, i) => (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              className="glass-card p-5 flex items-center gap-4 hover:glow-gold transition-all duration-300 group text-left"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="w-12 h-12 rounded-xl gradient-gold flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                <tab.icon className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">{tab.label}</h3>
                <p className="text-xs text-muted-foreground">
                  {tab.id === "articles" && "Read inspiring articles and devotionals"}
                  {tab.id === "music" && "Browse and play songs, karaoke, and more"}
                  {tab.id === "games" && "Test your knowledge with trivia games"}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
      <div className="h-8" />
    </AppLayout>
  );
};

export default Discover;
