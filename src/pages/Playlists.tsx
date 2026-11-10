import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import DownloadButton from "@/components/offline/DownloadButton";
import { useSaveSong } from "@/hooks/useSaveSong";
import DownloadAllButton from "@/components/offline/DownloadAllButton";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayer, type PlayerSong } from "@/contexts/PlayerContext";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAll";
import { loadPlaylists } from "@/lib/playlistData";
import { nextPlaylistOrder, orderedPlaylistEntries, playlistArtwork } from "@/lib/playlistArtwork";
import PlaylistArtwork from "@/components/playlist/PlaylistArtwork";
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
  const { save, canSave } = useSaveSong();
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
  const nextOrderRef = useRef(0);

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
      if (!user) return [];
      return loadPlaylists(user.id);
    },
  });

  const { data: adminPlaylists = [] } = useQuery({
    queryKey: ["admin-playlists", user?.id],
    queryFn: async () => {
      const data = await loadPlaylists(undefined, !!user);
      return data.filter(p => p.user_id !== user?.id);
    },
  });

  const [searchParams] = useSearchParams();
  const linkedId = searchParams.get("id");
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const handledLink = useRef<string | null>(null);
  useEffect(() => {
    if (!linkedId || handledLink.current === linkedId) return;
    const all = [...adminPlaylists, ...myPlaylists];
    if (all.length === 0) return;
    handledLink.current = linkedId;
    if (!all.some((p: any) => p.id === linkedId)) { toast.error("Playlist not available"); return; }
    setExpandedPlaylists(prev => new Set(prev).add(linkedId));
    setHighlightId(linkedId);
    requestAnimationFrame(() => document.getElementById(`playlist-${linkedId}`)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" }));
    const t = setTimeout(() => setHighlightId(null), 2500);
    return () => clearTimeout(t);
  }, [linkedId, adminPlaylists, myPlaylists]);

  const createPlaylist = useMutation({
    mutationFn: async (name: string) => {
      if (!user) throw new Error("Sign in required");
      const { error } = await supabase.from("playlists").insert({ name, user_id: user.id });
      if (error) throw error;
    },
    onError: () => toast.error("Couldn't create the playlist — please try again"),
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

  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const removeSongFromPlaylist = async (playlistSongId: string) => {
    if (removingIds.has(playlistSongId)) return;
    setRemovingIds((s) => new Set(s).add(playlistSongId));
    const { error } = await supabase.from("playlist_songs").delete().eq("id", playlistSongId);
    setRemovingIds((s) => { const n = new Set(s); n.delete(playlistSongId); return n; });
    if (error) { toast.error("Failed to remove song"); return; }
    queryClient.invalidateQueries({ queryKey: ["playlists-page"] });
    queryClient.invalidateQueries({ queryKey: ["library-playlists"] });
    toast.success("Song removed from playlist");
  };

  const openManageSongs = async (playlistId: string) => {
    setManagingSongsPlaylistId(playlistId);
    setSongSearch("");
    const [{ data: songs }, { data: existing }] = await Promise.all([
      fetchAllRows((from, to) => supabase.from("songs").select("id, title, artist, cover_url").order("title").order("id").range(from, to)).then((data) => ({ data }), () => ({ data: null })),
      fetchAllRows((from, to) => supabase.from("playlist_songs").select("song_id,sort_order").eq("playlist_id", playlistId).order("id").range(from, to)).then((data) => ({ data })),
    ]);
    setAllSongs(sortSongsByTitle(songs || []));
    setPlaylistSongIds(new Set((existing || []).map((e) => e.song_id)));
    nextOrderRef.current = nextPlaylistOrder(existing || []);
  };

  // The tick shows on the first tap; repeat taps wait for the save, and a failed save is undone.
  const togglingIds = useRef<Set<string>>(new Set());
  const markSong = (songId: string, inList: boolean) =>
    setPlaylistSongIds((prev) => { const next = new Set(prev); if (inList) next.add(songId); else next.delete(songId); return next; });
  const toggleSongInPlaylist = async (songId: string) => {
    if (!managingSongsPlaylistId || togglingIds.current.has(songId)) return;
    togglingIds.current.add(songId);
    const adding = !playlistSongIds.has(songId);
    markSong(songId, adding);
    const { error } = adding
      ? await supabase.from("playlist_songs").insert({ playlist_id: managingSongsPlaylistId, song_id: songId, sort_order: nextOrderRef.current++ })
      : await supabase.from("playlist_songs").delete().eq("playlist_id", managingSongsPlaylistId).eq("song_id", songId);
    togglingIds.current.delete(songId);
    if (error) {
      markSong(songId, !adding);
      toast.error(adding ? "Couldn't add the song — please try again" : "Couldn't remove the song — please try again");
    }
    queryClient.invalidateQueries({ queryKey: ["playlists-page"] });
    queryClient.invalidateQueries({ queryKey: ["library-playlists"] });
    queryClient.invalidateQueries({ queryKey: ["user-playlists-for-add"] });
  };

  const filteredSongs = allSongs.filter(s =>
    s.title.toLowerCase().includes(songSearch.toLowerCase()) ||
    s.artist.toLowerCase().includes(songSearch.toLowerCase())
  );

  const toPlayerSong = (s: any): PlayerSong => ({
    id: s.id, title: s.title, artist: s.artist, album: s.album || undefined,
    coverUrl: s.cover_url || undefined, audioUrl: s.audio_url || undefined,
    instrumentalUrl: s.instrumental_url || undefined, lyricsLrc: s.lyrics_lrc || undefined,
    durationSeconds: s.duration_seconds, isFreeDownload: !!s.is_free_download,
  });

  const formatDuration = (sec: number) => `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, "0")}`;

  const renderPlaylist = (pl: any, isOwn: boolean) => {
    const playlistSongs = orderedPlaylistEntries<any>(pl.playlist_songs || []).filter((ps: any) => ps.songs);
    const cover = playlistArtwork(pl, isOwn);
    const songs = playlistSongs.map((ps: any) => toPlayerSong(ps.songs));
    const isEditing = editingId === pl.id;
    const requiresAuth = !user && !isOwn;
    const isExpanded = expandedPlaylists.has(pl.id);

    return (
      <div key={pl.id} id={`playlist-${pl.id}`} className={`rounded-xl border p-4 transition-shadow duration-700 ${highlightId === pl.id ? "border-gold shadow-[0_0_24px_hsl(43_70%_53%/0.5)]" : "border-border"}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => toggleExpanded(pl.id)} aria-label={`${isExpanded ? "Collapse" : "Expand"} ${pl.name}`} aria-expanded={isExpanded} className="shrink-0 w-6 h-11">
            <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-0" : "-rotate-90"}`} />
          </Button>
            <PlaylistArtwork cover={cover} name={pl.name} />
            {isEditing ? (
              <form onSubmit={(e) => { e.preventDefault(); renamePlaylist(pl.id, editName); }} className="flex items-center gap-1 flex-1" onClick={e => e.stopPropagation()}>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-7 text-sm" autoFocus />
                <Button type="submit" variant="ghost" size="icon" aria-label="Save playlist name" className="w-7 h-7"><Check className="w-4 h-4" /></Button>
                <Button type="button" variant="ghost" size="icon" aria-label="Cancel rename" onClick={() => setEditingId(null)} className="w-7 h-7"><X className="w-4 h-4" /></Button>
              </form>
            ) : (
              <>
                <Button variant="ghost" onClick={() => toggleExpanded(pl.id)} className="min-w-0 flex-1 justify-start px-0 hover:bg-transparent"><h3 className="font-semibold text-foreground truncate">{pl.name}</h3></Button>
                {user && <span className="text-xs text-muted-foreground shrink-0">({songs.length})</span>}
                {!isOwn && <span className="text-[10px] font-semibold uppercase tracking-wider text-gold bg-gold/10 px-2 py-0.5 rounded-full shrink-0">Official</span>}
              </>
            )}
          </div>
          <div className="flex gap-1 shrink-0">
            <ShareMenu
              url={buildShareUrl(`/playlists?id=${pl.id}`)}
              title={pl.name}
              text={`Check out this playlist: ${pl.name}`}
              imageUrl={cover || undefined}
              card={isOwn ? undefined : { kind: "playlist", id: pl.id, title: pl.name, subtitle: `${songs.length} songs`, coverUrl: cover || undefined }}
            />
            {songs.length > 0 && (
              <>
                <button onClick={() => playQueue(songs)} className="w-8 h-8 rounded-full bg-gradient-to-br from-gold via-gold-light to-gold flex items-center justify-center shadow-[0_2px_12px_hsl(43_70%_53%/0.4)] ring-1 ring-white/20 hover:scale-110 transition-transform">
                  <Play className="w-3.5 h-3.5 text-white ml-0.5 drop-shadow-sm" fill="currentColor" />
                </button>
                <button onClick={() => { const shuffled = [...songs].sort(() => Math.random() - 0.5); playQueue(shuffled); }} aria-label={`Shuffle ${pl.name}`} className="p-2 text-gold hover:bg-gold/10 rounded-lg transition-colors">
                  <Shuffle className="w-4 h-4" />
                </button>
              </>
            )}
            {isOwn && !isEditing && (
              <>
                <button onClick={() => openManageSongs(pl.id)} className="p-2 text-muted-foreground hover:text-primary transition-colors" title="Manage songs">
                  <Settings2 className="w-4 h-4" />
                </button>
                <button aria-label={`Rename ${pl.name}`} onClick={() => { setEditingId(pl.id); setEditName(pl.name); }} className="p-2 text-muted-foreground hover:text-foreground transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => deletePlaylist.mutate(pl.id)} disabled={deletePlaylist.isPending && deletePlaylist.variables === pl.id} aria-label="Delete playlist" className="p-2 disabled:opacity-50 text-muted-foreground hover:text-destructive transition-colors">
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
                <div className="flex justify-end pb-1"><DownloadAllButton songs={songs} what="playlist" /></div>
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
                      {song.audioUrl && <DownloadButton songId={song.id} title={song.title} onDownload={() => save(song)} needsPremium={!canSave(song)} />}
                      {isOwn && (
                        <button onClick={() => removeSongFromPlaylist(ps.id)} disabled={removingIds.has(ps.id)} aria-label="Remove from playlist" className="p-1.5 disabled:opacity-50 text-muted-foreground hover:text-destructive transition-colors shrink-0">
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
                <form onSubmit={(e) => { e.preventDefault(); if (newPlaylistName.trim() && !createPlaylist.isPending) createPlaylist.mutate(newPlaylistName.trim()); }} className="flex gap-2">
                  <Input placeholder="Playlist name" value={newPlaylistName} onChange={(e) => setNewPlaylistName(e.target.value)} />
                  <Button type="submit" disabled={!newPlaylistName.trim() || createPlaylist.isPending}>{createPlaylist.isPending ? "Creating…" : "Create"}</Button>
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
