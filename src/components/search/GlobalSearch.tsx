import { useState, useEffect, useCallback, useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, Music, Disc3, User, ListMusic, BookOpen, CornerDownLeft } from "lucide-react";
import { normalize } from "@/lib/fuzzySearch";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { usePlayer } from "@/contexts/PlayerContext";
import { sortSongsByTitle } from "@/lib/utils";
import Highlight from "@/components/search/Highlight";
import { lyricsSnippet } from "@/lib/fuzzySearch";

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Escapes characters that break PostgREST `or()` filter syntax. */
const safe = (q: string) => q.replace(/[,()]/g, " ").trim();

const GlobalSearch = ({ open, onOpenChange }: GlobalSearchProps) => {
  const [query, setQuery] = useState("");
  const [songs, setSongs] = useState<any[]>([]);
  const [albums, setAlbums] = useState<any[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [articles, setArticles] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { playSong } = usePlayer();

  const reset = () => {
    setSongs([]); setAlbums([]); setPlaylists([]); setArticles([]); setUsers([]);
  };

  const search = useCallback(async (raw: string) => {
    const q = safe(raw);
    if (q.length < 2) { reset(); return; }
    setLoading(true);
    const [songsRes, albumsRes, playlistsRes, articlesRes, usersRes] = await Promise.all([
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
    ]);
    setSongs(sortSongsByTitle(songsRes.data || []));
    setAlbums(albumsRes.data || []);
    setPlaylists(playlistsRes.data || []);
    setArticles(articlesRes.data || []);
    setUsers(usersRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!open) { setQuery(""); reset(); }
  }, [open]);

  useEffect(() => {
    const t = setTimeout(() => search(query), 300);
    return () => clearTimeout(t);
  }, [query, search]);

  const handleSongClick = (song: any) => {
    playSong({
      id: song.id, title: song.title, artist: song.artist,
      coverUrl: song.cover_url, audioUrl: song.audio_url,
      instrumentalUrl: song.instrumental_url, lyricsLrc: song.lyrics_lrc,
      durationSeconds: song.duration_seconds, album: song.album,
    });
    onOpenChange(false);
  };

  const go = (path: string) => { navigate(path); onOpenChange(false); };

  const hasResults = songs.length > 0 || albums.length > 0 || playlists.length > 0 || articles.length > 0 || users.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search songs, lyrics, albums, playlists, articles…"
            className="border-0 bg-transparent focus-visible:ring-0 px-0 h-auto text-sm"
            autoFocus
          />
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {loading && <p className="text-xs text-muted-foreground text-center py-6">Searching…</p>}
          {!loading && query.length >= 2 && !hasResults && (
            <p className="text-xs text-muted-foreground text-center py-6">No results found</p>
          )}
          {songs.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 pt-3 pb-1">Songs</p>
              {songs.map(s => {
                const snippet = lyricsSnippet(s.lyrics_text || s.lyrics_lrc, query);
                return (
                  <button key={s.id} onClick={() => handleSongClick(s)} className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-muted/40 transition-colors text-left">
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                      {s.cover_url ? <img src={s.cover_url} alt="" className="w-full h-full object-cover" /> : <Music className="w-4 h-4 text-muted-foreground" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate"><Highlight text={s.title} query={query} /></p>
                      <p className="text-xs text-muted-foreground truncate"><Highlight text={s.artist} query={query} /></p>
                      {snippet && <p className="text-[11px] text-muted-foreground/80 line-clamp-1 italic"><Highlight text={snippet} query={query} /></p>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {albums.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 pt-3 pb-1">Albums</p>
              {albums.map(a => (
                <button key={a.id} onClick={() => go("/albums")} className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-muted/40 transition-colors text-left">
                  <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                    {a.cover_url ? <img src={a.cover_url} alt="" className="w-full h-full object-cover" /> : <Disc3 className="w-4 h-4 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate"><Highlight text={a.title} query={query} /></p>
                    <p className="text-xs text-muted-foreground truncate">{a.artist}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {playlists.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 pt-3 pb-1">Global Playlists</p>
              {playlists.map(p => (
                <button key={p.id} onClick={() => go("/playlists")} className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-muted/40 transition-colors text-left">
                  <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                    {p.cover_url ? <img src={p.cover_url} alt="" className="w-full h-full object-cover" /> : <ListMusic className="w-4 h-4 text-muted-foreground" />}
                  </div>
                  <p className="text-sm font-medium text-foreground truncate"><Highlight text={p.name} query={query} /></p>
                </button>
              ))}
            </div>
          )}
          {articles.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 pt-3 pb-1">Articles</p>
              {articles.map(a => (
                <button key={a.id} onClick={() => go(`/articles?id=${a.id}`)} className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-muted/40 transition-colors text-left">
                  <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
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
          {users.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 pt-3 pb-1">Users</p>
              {users.map(u => (
                <button key={u.user_id} onClick={() => go(`/user/${u.user_id}`)} className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-muted/40 transition-colors text-left">
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
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
      </DialogContent>
    </Dialog>
  );
};

export default GlobalSearch;
