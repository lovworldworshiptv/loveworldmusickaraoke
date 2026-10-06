import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayer, type PlayerSong } from "@/contexts/PlayerContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ListMusic, Plus, Trash2, Play, Music, Shuffle, Pencil, Check, X, Minus, ChevronDown, Search, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SongRowSkeleton, EmptyState } from "@/components/ui/loading-skeleton";
import { toast } from "sonner";
import ShareMenu, { buildShareUrl } from "@/components/share/ShareMenu";
import { sortSongsByTitle, compareTitles } from "@/lib/utils";

const Playlists = () => {
  const { user } = useAuth();
  const { playSong, playQueue, currentSong, isPlaying } = usePlayer();
  const queryClient = useQueryClient();
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [expandedPlaylists, setExpandedPlaylists] = useState<Set<string>>(new Set());

  // Manage songs state
  const [managingSongsPlaylistId, setManagingSongsPlaylistId] = useState<string | null>(null);
  const [allSongs, setAllSongs] = useState<any[]>([]);
  const [playlistSongIds, setPlaylistSongIds] = useState<Set<string>>(new Set());
  const [songSearch, setSongSearch] = useState("");

  const toggleExpanded = (id: string) => {
    setExpandedPlaylists(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const { data: myPlaylists = [], isLoading } = useQuery({
    queryKey: ["playlists-page", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playlists")
        .select("id, name, cover_url, created_at, user_id, playlist_songs(id, song_id, sort_order, songs(id, title, artist, cover_url, audio_url, instrumental_url, lyrics_lrc, duration_seconds, album))")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: adminPlaylists = [] } = useQuery({
    queryKey: ["admin-playlists", user?.id],
    queryFn: async () => {
      const selectFields = user
        ? "id, name, cover_url, created_at, user_id, playlist_songs(id, song_id, sort_order, songs(id, title, artist, cover_url, audio_url, instrumental_url, lyrics_lrc, duration_seconds, album))"
        : "id, name, cover_url, created_at, user_id";
      const { data, error } = await supabase
        .from("playlists")
        .select(selectFields)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]).filter(p => p.user_id !== user?.id);
    },
  });

  const createPlaylist = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("playlists").insert({ name, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlists-page"] });
      setNewPlaylistName("");
      setDialogOpen(false);
      toast.success("Playlist created!");
    },
  });

  const deletePlaylist = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("playlist_songs").delete().eq("playlist_id", id);
      await supabase.from("playlists").delete().eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["playlists-page"] });
      toast.success("Playlist deleted");
    },
  });

  const renamePlaylist = async (id: string, name: string) => {
    if (!name.trim()) return;
    const { error } = await supabase.from("playlists").update({ name: name.trim() }).eq("id", id);
    if (error) { toast.error("Failed to rename"); return; }
    queryClient.invalidateQueries({ queryKey: ["playlists-page"] });
    setEditingId(null);
    toast.success("Playlist renamed");
  };

  const removeSongFromPlaylist = async (playlistSongId: string) => {
    const { error } = await supabase.from("playlist_songs").delete().eq("id", playlistSongId);
    if (error) { toast.error("Failed to remove song"); return; }
    queryClient.invalidateQueries({ queryKey: ["playlists-page"] });
    queryClient.invalidateQueries({ queryKey: ["library-playlists"] });
    toast.success("Song removed from playlist");
  };

  const openManageSongs = async (playlistId: string) => {
    setManagingSongsPlaylistId(playlistId);
    setSongSearch("");
    const [{ data: songs }, { data: existing }] = await Promise.all([
      supabase.from("songs").select("id, title, artist, cover_url").order("title"),
      supabase.from("playlist_songs").select("song_id").eq("playlist_id", playlistId),
    ]);
    setAllSongs(sortSongsByTitle(songs || []));
    setPlaylistSongIds(new Set((existing || []).map((e) => e.song_id)));
  };

  const toggleSongInPlaylist = async (songId: string) => {
    if (!managingSongsPlaylistId) return;
    if (playlistSongIds.has(songId)) {
      await supabase.from("playlist_songs").delete().eq("playlist_id", managingSongsPlaylistId).eq("song_id", songId);
      setPlaylistSongIds(prev => { const next = new Set(prev); next.delete(songId); return next; });
    } else {
      const { error } = await supabase.from("playlist_songs").insert({
        playlist_id: managingSongsPlaylistId, song_id: songId, sort_order: playlistSongIds.size,
      });
      if (error) { toast.error(error.message); return; }
      setPlaylistSongIds(prev => new Set(prev).add(songId));
    }
  };

  const filteredSongs = allSongs.filter(s =>
    s.title.toLowerCase().includes(songSearch.toLowerCase()) ||
    s.artist.toLowerCase().includes(songSearch.toLowerCase())
  );

  const toPlayerSong = (s: any): PlayerSong => ({
    id: s.id, title: s.title, artist: s.artist, album: s.album || undefined,
    coverUrl: s.cover_url || undefined, audioUrl: s.audio_url || undefined,
    instrumentalUrl: s.instrumental_url || undefined, lyricsLrc: s.lyrics_lrc || undefined,
    durationSeconds: s.duration_seconds,
  });

  const formatDuration = (sec: number) => `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, "0")}`;

  const renderPlaylist = (pl: any, isOwn: boolean) => {
    const playlistSongs = (pl.playlist_songs || []).filter((ps: any) => ps.songs);
    const songs = playlistSongs.map((ps: any) => toPlayerSong(ps.songs));
    const isEditing = editingId === pl.id;
    const requiresAuth = !user && !isOwn;
    const isExpanded = expandedPlaylists.has(pl.id);

    return (
      <div key={pl.id} className="rounded-xl border border-border p-4">
        <div className="flex items-center justify-between">
          <button onClick={() => toggleExpanded(pl.id)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
            <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-0" : "-rotate-90"}`} />
            <ListMusic className="w-5 h-5 text-primary shrink-0" />
            {isEditing ? (
              <form onSubmit={(e) => { e.preventDefault(); renamePlaylist(pl.id, editName); }} className="flex items-center gap-1 flex-1" onClick={e => e.stopPropagation()}>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-7 text-sm" autoFocus />
                <button type="submit" className="p-1 text-green-500 hover:text-green-600"><Check className="w-4 h-4" /></button>
                <button type="button" onClick={() => setEditingId(null)} className="p-1 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
              </form>
            ) : (
              <>
                <h3 className="font-semibold text-foreground truncate">{pl.name}</h3>
                <span className="text-xs text-muted-foreground shrink-0">({songs.length})</span>
                {!isOwn && <span className="text-[10px] font-semibold uppercase tracking-wider text-gold bg-gold/10 px-2 py-0.5 rounded-full shrink-0">Official</span>}
              </>
            )}
          </button>
          <div className="flex gap-1 shrink-0">
            <ShareMenu
              url={buildShareUrl(`/playlists?id=${pl.id}`)}
              title={pl.name}
              text={`Check out this playlist: ${pl.name}`}
              imageUrl={pl.cover_url || (songs[0]?.coverUrl ? songs[0].coverUrl : undefined)}
            />
            {songs.length > 0 && (
              <>
                <button onClick={() => playQueue(songs)} className="w-8 h-8 rounded-full bg-gradient-to-br from-gold via-gold-light to-gold flex items-center justify-center shadow-[0_2px_12px_hsl(43_70%_53%/0.4)] ring-1 ring-white/20 hover:scale-110 transition-transform">
                  <Play className="w-3.5 h-3.5 text-white ml-0.5 drop-shadow-sm" fill="currentColor" />
                </button>
                <button onClick={() => { const shuffled = [...songs].sort(() => Math.random() - 0.5); playQueue(shuffled); }} className="p-2 text-gold hover:bg-gold/10 rounded-lg transition-colors">
                  <Shuffle className="w-4 h-4" />
                </button>
              </>
            )}
            {isOwn && !isEditing && (
              <>
                <button onClick={() => openManageSongs(pl.id)} className="p-2 text-muted-foreground hover:text-primary transition-colors" title="Manage songs">
                  <Settings2 className="w-4 h-4" />
                </button>
                <button onClick={() => { setEditingId(pl.id); setEditName(pl.name); }} className="p-2 text-muted-foreground hover:text-foreground transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => deletePlaylist.mutate(pl.id)} className="p-2 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
        {isExpanded && (
          <div className="mt-3">
            {requiresAuth ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-2">Sign in to view tracks in this playlist</p>
                <Button size="sm" variant="outline" onClick={() => window.location.href = "/auth"} className="gap-1.5">
                  Sign In
                </Button>
              </div>
            ) : songs.length > 0 ? (
              <div className="space-y-1">
                {playlistSongs.map((ps: any, i: number) => {
                  const song = toPlayerSong(ps.songs);
                  const isActive = currentSong?.id === song.id;
                  return (
                    <div key={ps.id} className={`flex items-center gap-3 w-full p-2 rounded-lg transition-colors ${isActive ? "bg-muted/80" : "hover:bg-muted/40"}`}>
                      <button onClick={() => playQueue(songs, i)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                        {song.coverUrl ? (
                          <img src={song.coverUrl} alt="" className="w-10 h-10 rounded object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded bg-primary/20 flex items-center justify-center"><Music className="w-4 h-4 text-primary" /></div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate text-foreground">{song.title}</p>
                          <p className="text-xs text-foreground truncate">{song.artist}</p>
                        </div>
                        <span className="text-xs text-muted-foreground">{formatDuration(song.durationSeconds || 0)}</span>
                      </button>
                      {isOwn && (
                        <button onClick={() => removeSongFromPlaylist(ps.id)} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors shrink-0">
                          <Minus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No songs in this playlist</p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 lg:pt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-serif font-bold text-foreground">Playlists</h2>
          {user && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gradient-gold text-primary-foreground gap-1">
                  <Plus className="w-4 h-4" /> New
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create Playlist</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); if (newPlaylistName.trim()) createPlaylist.mutate(newPlaylistName.trim()); }} className="flex gap-2">
                  <Input placeholder="Playlist name" value={newPlaylistName} onChange={(e) => setNewPlaylistName(e.target.value)} />
                  <Button type="submit" disabled={!newPlaylistName.trim()}>Create</Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {adminPlaylists.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Official Playlists</h3>
            <div className="space-y-4">{adminPlaylists.map((pl: any) => renderPlaylist(pl, false))}</div>
          </div>
        )}

        {!user ? (
          <EmptyState icon={ListMusic} title="Sign in to create playlists" description="Create an account to organize your music" />
        ) : isLoading ? (
          <div className="space-y-1">{Array.from({ length: 4 }).map((_, i) => <SongRowSkeleton key={i} />)}</div>
        ) : myPlaylists.length === 0 && adminPlaylists.length === 0 ? (
          <EmptyState icon={ListMusic} title="No playlists yet" description="Create your first playlist" />
        ) : myPlaylists.length > 0 ? (
          <div className="space-y-4">
            {adminPlaylists.length > 0 && (
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">My Playlists</h3>
            )}
            {myPlaylists.map((pl: any) => renderPlaylist(pl, true))}
          </div>
        ) : null}
      </div>

      {/* Manage Songs Dialog */}
      <Dialog open={!!managingSongsPlaylistId} onOpenChange={() => {
        setManagingSongsPlaylistId(null);
        queryClient.invalidateQueries({ queryKey: ["playlists-page"] });
        queryClient.invalidateQueries({ queryKey: ["library-playlists"] });
      }}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Manage Songs in Playlist</DialogTitle>
          </DialogHeader>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search songs..."
              value={songSearch}
              onChange={(e) => setSongSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex-1 overflow-y-auto space-y-1">
            {filteredSongs.map((song) => {
              const inPlaylist = playlistSongIds.has(song.id);
              return (
                <button
                  key={song.id}
                  onClick={() => toggleSongInPlaylist(song.id)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-colors text-left ${inPlaylist ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-muted/60"}`}
                >
                  {song.cover_url ? (
                    <img src={song.cover_url} alt="" className="w-10 h-10 rounded object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-primary/20 flex items-center justify-center"><Music className="w-4 h-4 text-primary" /></div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate text-foreground">{song.title}</p>
                    <p className="text-xs text-foreground truncate">{song.artist}</p>
                  </div>
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${inPlaylist ? "bg-primary border-primary" : "border-muted-foreground"}`}>
                    {inPlaylist && <span className="text-primary-foreground text-xs">✓</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <div className="h-8" />
    </AppLayout>
  );
};

export default Playlists;
