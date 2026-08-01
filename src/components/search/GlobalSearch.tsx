import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, Music, Disc3, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { usePlayer } from "@/contexts/PlayerContext";
import { sortSongsByTitle, compareTitles } from "@/lib/utils";

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const GlobalSearch = ({ open, onOpenChange }: GlobalSearchProps) => {
  const [query, setQuery] = useState("");
  const [songs, setSongs] = useState<any[]>([]);
  const [albums, setAlbums] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { playSong } = usePlayer();

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setSongs([]); setAlbums([]); setUsers([]); return; }
    setLoading(true);
    const [songsRes, albumsRes, usersRes] = await Promise.all([
      supabase.from("songs").select("id, title, artist, cover_url, audio_url, instrumental_url, lyrics_lrc, duration_seconds, album").ilike("title", `%${q}%`).limit(5),
      supabase.from("albums").select("id, title, artist, cover_url").ilike("title", `%${q}%`).limit(5),
      supabase.from("profiles").select("user_id, username, avatar_url, kingschat_handle").or(`username.ilike.%${q}%,kingschat_handle.ilike.%${q}%`).limit(5),
    ]);
    setSongs(sortSongsByTitle(songsRes.data || []));
    setAlbums(albumsRes.data || []);
    setUsers(usersRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!open) { setQuery(""); setSongs([]); setAlbums([]); setUsers([]); return; }
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

  const handleAlbumClick = (album: any) => {
    navigate(`/albums`);
    onOpenChange(false);
  };

  const handleUserClick = (user: any) => {
    navigate(`/user/${user.user_id}`);
    onOpenChange(false);
  };

  const hasResults = songs.length > 0 || albums.length > 0 || users.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search songs, albums, users..."
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
              {songs.map(s => (
                <button key={s.id} onClick={() => handleSongClick(s)} className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-muted/40 transition-colors text-left">
                  <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                    {s.cover_url ? <img src={s.cover_url} alt="" className="w-full h-full object-cover" /> : <Music className="w-4 h-4 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{s.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{s.artist}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {albums.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 pt-3 pb-1">Albums</p>
              {albums.map(a => (
                <button key={a.id} onClick={() => handleAlbumClick(a)} className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-muted/40 transition-colors text-left">
                  <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                    {a.cover_url ? <img src={a.cover_url} alt="" className="w-full h-full object-cover" /> : <Disc3 className="w-4 h-4 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{a.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{a.artist}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {users.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-4 pt-3 pb-1">Users</p>
              {users.map(u => (
                <button key={u.user_id} onClick={() => handleUserClick(u)} className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-muted/40 transition-colors text-left">
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                    {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover rounded-full" /> : <User className="w-4 h-4 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{u.username}</p>
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
