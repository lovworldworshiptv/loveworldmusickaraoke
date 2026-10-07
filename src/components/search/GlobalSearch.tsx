import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Search, Music, Disc3, User, ListMusic, BookOpen, CornerDownLeft,
  X, Clock, Sparkles, ArrowUp, ArrowDown, Loader2, Compass,
} from "lucide-react";
import { normalize } from "@/lib/fuzzySearch";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { usePlayer } from "@/contexts/PlayerContext";
import { sortSongsByTitle, cn } from "@/lib/utils";
import Highlight from "@/components/search/Highlight";
import { lyricsSnippet } from "@/lib/fuzzySearch";

interface GlobalSearchProps {
  open: boolean;
  /** Filter chip selected when the dialog opens. */
  initialFilter?: string;
  onOpenChange: (open: boolean) => void;
}

/** Escapes characters that break PostgREST `or()` filter syntax. */
const safe = (q: string) => q.replace(/[,()]/g, " ").trim();

const RECENTS_KEY = "global_search_recents";
const FILTERS = [
  { id: "all", label: "All", icon: Sparkles },
  { id: "discover", label: "Discover", icon: Compass },
  { id: "songs", label: "Songs", icon: Music },
  { id: "albums", label: "Albums", icon: Disc3 },
  { id: "playlists", label: "Playlists", icon: ListMusic },
  { id: "articles", label: "Articles", icon: BookOpen },
  { id: "users", label: "People", icon: User },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

const readRecents = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(RECENTS_KEY) || "[]");
    return Array.isArray(v) ? v.slice(0, 6) : [];
  } catch {
    return [];
  }
};

const GlobalSearch = ({ open, onOpenChange, initialFilter }: GlobalSearchProps) => {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");
  const [songs, setSongs] = useState<any[]>([]);
  const [albums, setAlbums] = useState<any[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [articles, setArticles] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [discover, setDiscover] = useState<{ id: string; title: string; subtitle: string | null; path: string; image: string | null; kind: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [recents, setRecents] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { playSong } = usePlayer();

  const reset = () => {
    setSongs([]); setAlbums([]); setPlaylists([]); setArticles([]); setUsers([]); setDiscover([]);
  };

  const rememberQuery = (q: string) => {
    const t = q.trim();
    if (t.length < 2) return;
    const next = [t, ...readRecents().filter(r => r.toLowerCase() !== t.toLowerCase())].slice(0, 6);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
    setRecents(next);
  };

  const clearRecents = () => {
    localStorage.removeItem(RECENTS_KEY);
    setRecents([]);
  };

  const search = useCallback(async (raw: string) => {
    const q = safe(raw);
    if (q.length < 2) { reset(); setLoading(false); return; }
    setLoading(true);
    const [songsRes, albumsRes, playlistsRes, articlesRes, usersRes, catsRes, featRes] = await Promise.all([
      supabase
        .from("songs")
        .select("id, title, artist, cover_url, audio_url, instrumental_url, lyrics_lrc, lyrics_text, duration_seconds, album")
        .or(`title.ilike.%${q}%,artist.ilike.%${q}%,lyrics_text.ilike.%${q}%,lyrics_lrc.ilike.%${q}%`)
        .limit(8),
      supabase.from("albums").select("id, title, artist, cover_url").or(`title.ilike.%${q}%,artist.ilike.%${q}%`).limit(5),
      supabase
        .from("playlists")
        .select("id, name, cover_url")
        .eq("is_visible_on_homepage", true)
        .ilike("name", `%${q}%`)
        .limit(5),
      supabase
        .from("articles")
        .select("id, title, excerpt, author, category")
        .eq("is_published", true)
        .or(`title.ilike.%${q}%,excerpt.ilike.%${q}%,content.ilike.%${q}%,author.ilike.%${q}%`)
        .limit(5),
      supabase.from("profiles").select("user_id, username, avatar_url, kingschat_handle").or(`username.ilike.%${q}%,kingschat_handle.ilike.%${q}%`).limit(5),
      (supabase as any).from("discover_categories").select("id, title, subtitle, route, image_url").eq("is_visible", true)
        .or(`title.ilike.%${q}%,subtitle.ilike.%${q}%`).order("sort_order").limit(6),
      (supabase as any).from("discover_featured").select("id, label, description, href, image_url, poster_url, song_ids").eq("is_active", true)
        .or(`label.ilike.%${q}%,description.ilike.%${q}%`).order("sort_order").limit(6),
    ]);
    setDiscover([
      ...((catsRes.data || []) as any[]).map((c) => ({ id: `c-${c.id}`, title: c.title, subtitle: c.subtitle, path: c.route, image: c.image_url, kind: "Category" })),
      ...((featRes.data || []) as any[]).map((f) => ({
        id: `f-${f.id}`, title: f.label, subtitle: f.description, image: f.image_url || f.poster_url, kind: "Featured playlist",
        path: f.song_ids?.length ? `/discover/featured/${f.id}` : f.href || `/discover/tag/${encodeURIComponent(f.label.replace(/^#/, ""))}`,
      })),
    ]);
    setSongs(sortSongsByTitle(songsRes.data || []));
    setAlbums(albumsRes.data || []);
    setPlaylists(playlistsRes.data || []);
    setArticles(articlesRes.data || []);
    setUsers(usersRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!open) { setQuery(""); setFilter("all"); reset(); }
    else { setRecents(readRecents()); if (initialFilter) setFilter(initialFilter as FilterId); }
  }, [open]);

  useEffect(() => {
    if (query.trim().length >= 2) setLoading(true);
    const t = setTimeout(() => search(query), 180);
    return () => clearTimeout(t);
  }, [query, search]);

  const go = (path: string) => { rememberQuery(query); navigate(path); onOpenChange(false); };

  const handleSongClick = (song: any) => {
    rememberQuery(query);
    playSong({
      id: song.id, title: song.title, artist: song.artist,
      coverUrl: song.cover_url, audioUrl: song.audio_url,
      instrumentalUrl: song.instrumental_url, lyricsLrc: song.lyrics_lrc,
      durationSeconds: song.duration_seconds, album: song.album,
    });
    onOpenChange(false);
  };

  const show = (id: FilterId) => filter === "all" || filter === id;

  const vDiscover = show("discover") ? discover : [];
  const vSongs = show("songs") ? songs : [];
  const vAlbums = show("albums") ? albums : [];
  const vPlaylists = show("playlists") ? playlists : [];
  const vArticles = show("articles") ? articles : [];
  const vUsers = show("users") ? users : [];

  const counts: Record<FilterId, number> = {
    discover: discover.length,
    all: discover.length + songs.length + albums.length + playlists.length + articles.length + users.length,
    songs: songs.length,
    albums: albums.length,
    playlists: playlists.length,
    articles: articles.length,
    users: users.length,
  };

  /** Flat list for keyboard navigation. */
  const flat = useMemo(
    () => [
      ...vDiscover.map(d => ({ key: `disc-${d.id}`, run: () => go(d.path) })),
      ...vSongs.map(s => ({ key: `song-${s.id}`, run: () => handleSongClick(s) })),
      ...vAlbums.map(a => ({ key: `album-${a.id}`, run: () => go("/albums") })),
      ...vPlaylists.map(p => ({ key: `pl-${p.id}`, run: () => go("/playlists") })),
      ...vArticles.map(a => ({ key: `art-${a.id}`, run: () => go(`/articles?id=${a.id}`) })),
      ...vUsers.map(u => ({ key: `usr-${u.user_id}`, run: () => go(`/user/${u.user_id}`) })),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vDiscover, vSongs, vAlbums, vPlaylists, vArticles, vUsers, query],
  );

  useEffect(() => { setActiveIndex(0); }, [query, filter]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const hasResults = flat.length > 0;

  /** Autocomplete terms derived from live results, ranked by prefix match. */
  const suggestions = useMemo(() => {
    const nq = normalize(query);
    if (nq.length < 2) return [] as { label: string; kind: string }[];
    const raw: { label: string; kind: string }[] = [
      ...discover.map(d => ({ label: d.title, kind: "Discover" })),
      ...songs.map(s => ({ label: s.title, kind: "Song" })),
      ...songs.map(s => ({ label: s.artist, kind: "Artist" })),
      ...albums.map(a => ({ label: a.title, kind: "Album" })),
      ...playlists.map(p => ({ label: p.name, kind: "Playlist" })),
      ...articles.map(a => ({ label: a.title, kind: "Article" })),
    ];
    const seen = new Set<string>();
    const scored: { label: string; kind: string; score: number }[] = [];
    for (const item of raw) {
      if (!item.label) continue;
      const n = normalize(item.label);
      if (!n || seen.has(n) || n === nq) continue;
      let score = -1;
      if (n.startsWith(nq)) score = 0;
      else if (n.split(" ").some(w => w.startsWith(nq))) score = 1;
      else if (n.includes(nq)) score = 2;
      if (score < 0) continue;
      seen.add(n);
      scored.push({ ...item, score });
    }
    return scored
      .sort((a, b) => a.score - b.score || a.label.length - b.label.length)
      .slice(0, 6);
  }, [query, songs, albums, playlists, articles]);

  const applySuggestion = (label: string) => setQuery(label);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, Math.max(flat.length - 1, 0))); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); return; }
    if (e.key === "Enter" && flat[activeIndex]) { e.preventDefault(); flat[activeIndex].run(); return; }
    if ((e.key === "Tab" || e.key === "ArrowRight") && suggestions[0] && e.currentTarget.selectionStart === query.length) {
      if (e.key === "Tab") e.preventDefault();
      if (e.key === "ArrowRight" && query.length > 0) return;
      applySuggestion(suggestions[0].label);
    }
  };

  let cursor = -1;
  const rowProps = (onClick: () => void) => {
    cursor += 1;
    const idx = cursor;
    const active = idx === activeIndex;
    return {
      "data-active": active,
      onMouseEnter: () => setActiveIndex(idx),
      onClick,
      className: cn(
        "group flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-left transition-colors",
        active ? "bg-primary/10 ring-1 ring-primary/25" : "hover:bg-muted/40",
      ),
    };
  };

  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-semibold px-3 pt-4 pb-1.5">{children}</p>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-xl p-0 gap-0 overflow-hidden top-[8%] translate-y-0 sm:top-[10%] rounded-3xl border-border/60 glass shadow-2xl [&>button]:hidden"
      >
        <DialogTitle className="sr-only">Search</DialogTitle>

        {/* Search field */}
        <div className="relative">
          <div className="pointer-events-none absolute inset-x-0 -top-16 h-32 bg-gradient-to-b from-primary/15 to-transparent blur-2xl" />
          <div className="relative flex items-center gap-3 px-4 py-4 border-b border-border/60">
            <div className="w-9 h-9 rounded-xl gradient-gold flex items-center justify-center flex-shrink-0 shadow-[0_0_20px_hsl(var(--gold)/0.35)]">
              {loading ? (
                <Loader2 className="w-4 h-4 text-primary-foreground animate-spin" />
              ) : (
                <Search className="w-4 h-4 text-primary-foreground" />
              )}
            </div>
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search songs, lyrics, albums, playlists, articles…"
              className="border-0 bg-transparent focus-visible:ring-0 px-0 h-auto text-base placeholder:text-muted-foreground/70"
              autoFocus
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => onOpenChange(false)}
              className="hidden sm:inline-flex items-center rounded-lg border border-border/70 bg-muted/40 px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              ESC
            </button>
          </div>
        </div>

        {/* Filter pills */}
        {query.length >= 2 && (
          <div className="flex gap-1.5 overflow-x-auto px-3 py-2.5 border-b border-border/50 scrollbar-hide">
            {FILTERS.map(f => {
              const Icon = f.icon;
              const active = filter === f.id;
              const n = counts[f.id];
              if (f.id !== "all" && n === 0) return null;
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    "flex items-center gap-1.5 flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                    active
                      ? "gradient-gold text-primary-foreground shadow-[0_0_16px_hsl(var(--gold)/0.3)]"
                      : "border border-border/70 bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/60",
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {f.label}
                  {n > 0 && <span className={cn("text-[10px]", active ? "opacity-80" : "opacity-60")}>{n}</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* Autocomplete chips */}
        {suggestions.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto px-3 py-2 border-b border-border/50 scrollbar-hide">
            {suggestions.map(s => (
              <button
                key={`${s.kind}-${s.label}`}
                onClick={() => applySuggestion(s.label)}
                className="flex items-center gap-1.5 flex-shrink-0 rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-xs text-foreground hover:border-primary/40 hover:bg-primary/10 transition-colors"
              >
                <span className="truncate max-w-[160px]">{s.label}</span>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.kind}</span>
              </button>
            ))}
            <span className="hidden sm:flex items-center gap-1 flex-shrink-0 pl-1 text-[10px] text-muted-foreground">
              <CornerDownLeft className="w-3 h-3" /> Tab
            </span>
          </div>
        )}

        {/* Results */}
        <div ref={listRef} className="max-h-[58vh] overflow-y-auto px-2 pb-2 scrollbar-hide">
          {/* Idle state */}
          {query.length < 2 && (
            <div className="py-3">
              {recents.length > 0 && (
                <>
                  <div className="flex items-center justify-between px-3 pt-2 pb-1.5">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">Recent searches</p>
                    <button onClick={clearRecents} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">Clear</button>
                  </div>
                  {recents.map(r => (
                    <button
                      key={r}
                      onClick={() => setQuery(r)}
                      className="flex items-center gap-3 w-full px-3 py-2 rounded-xl hover:bg-muted/40 transition-colors text-left"
                    >
                      <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm text-foreground truncate">{r}</span>
                    </button>
                  ))}
                </>
              )}
              <div className="px-3 pt-4 pb-2">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-semibold pb-2">Explore</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Browse Songs", icon: Music, path: "/library" },
                    { label: "Albums", icon: Disc3, path: "/albums" },
                    { label: "Playlists", icon: ListMusic, path: "/playlists" },
                    { label: "Articles", icon: BookOpen, path: "/articles" },
                  ].map(item => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.path}
                        onClick={() => { navigate(item.path); onOpenChange(false); }}
                        className="flex items-center gap-2.5 rounded-2xl border border-border/60 bg-muted/20 px-3 py-3 text-sm text-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors"
                      >
                        <Icon className="w-4 h-4 text-primary" />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {!loading && query.length >= 2 && !hasResults && (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-muted/40 flex items-center justify-center">
                <Search className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">No results for “{query}”</p>
              <p className="text-xs text-muted-foreground">Try a different title, artist or lyric line.</p>
            </div>
          )}

          {vDiscover.length > 0 && (
            <div>
              <SectionLabel>Discover</SectionLabel>
              {vDiscover.map(d => (
                <button key={d.id} {...rowProps(() => go(d.path))}>
                  <div className="w-10 h-10 rounded-xl bg-gold/15 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {d.image ? <img src={d.image} alt="" className="w-full h-full object-cover" /> : <Compass className="w-4 h-4 text-gold" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate"><Highlight text={d.title} query={query} /></p>
                    <p className="text-xs text-foreground truncate">{d.kind}{d.subtitle ? ` · ${d.subtitle}` : ""}</p>
                  </div>
                  <CornerDownLeft className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}

          {vSongs.length > 0 && (
            <div>
              <SectionLabel>Songs</SectionLabel>
              {vSongs.map(s => {
                const snippet = lyricsSnippet(s.lyrics_text || s.lyrics_lrc, query);
                return (
                  <button key={s.id} {...rowProps(() => handleSongClick(s))}>
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                      {s.cover_url ? <img src={s.cover_url} alt="" className="w-full h-full object-cover" /> : <Music className="w-4 h-4 text-muted-foreground" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate"><Highlight text={s.title} query={query} /></p>
                      <p className="text-xs text-foreground truncate"><Highlight text={s.artist} query={query} /></p>
                      {snippet && <p className="text-[11px] text-muted-foreground/80 line-clamp-1 italic"><Highlight text={snippet} query={query} /></p>}
                    </div>
                    <CornerDownLeft className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          )}

          {vAlbums.length > 0 && (
            <div>
              <SectionLabel>Albums</SectionLabel>
              {vAlbums.map(a => (
                <button key={a.id} {...rowProps(() => go("/albums"))}>
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                    {a.cover_url ? <img src={a.cover_url} alt="" className="w-full h-full object-cover" /> : <Disc3 className="w-4 h-4 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate"><Highlight text={a.title} query={query} /></p>
                    <p className="text-xs text-foreground truncate">{a.artist}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {vPlaylists.length > 0 && (
            <div>
              <SectionLabel>Global Playlists</SectionLabel>
              {vPlaylists.map(p => (
                <button key={p.id} {...rowProps(() => go("/playlists"))}>
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                    {p.cover_url ? <img src={p.cover_url} alt="" className="w-full h-full object-cover" /> : <ListMusic className="w-4 h-4 text-muted-foreground" />}
                  </div>
                  <p className="text-sm font-medium text-foreground truncate"><Highlight text={p.name} query={query} /></p>
                </button>
              ))}
            </div>
          )}

          {vArticles.length > 0 && (
            <div>
              <SectionLabel>Articles</SectionLabel>
              {vArticles.map(a => (
                <button key={a.id} {...rowProps(() => go(`/articles?id=${a.id}`))}>
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate"><Highlight text={a.title} query={query} /></p>
                    <p className="text-xs text-muted-foreground truncate">{a.category} · {a.author}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {vUsers.length > 0 && (
            <div>
              <SectionLabel>People</SectionLabel>
              {vUsers.map(u => (
                <button key={u.user_id} {...rowProps(() => go(`/user/${u.user_id}`))}>
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                    {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover rounded-full" /> : <User className="w-4 h-4 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate"><Highlight text={u.username} query={query} /></p>
                    {u.kingschat_handle && <p className="text-xs text-muted-foreground truncate">@{u.kingschat_handle}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer hints */}
        <div className="hidden sm:flex items-center gap-4 px-4 py-2.5 border-t border-border/50 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><ArrowUp className="w-3 h-3" /><ArrowDown className="w-3 h-3" /> navigate</span>
          <span className="flex items-center gap-1"><CornerDownLeft className="w-3 h-3" /> open</span>
          <span className="ml-auto">Loveworld Music Karaoke+</span>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GlobalSearch;
