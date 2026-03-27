import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayer, type PlayerSong } from "@/contexts/PlayerContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ListMusic, Plus, Trash2, Play, Music, Shuffle, Pencil, Check, X, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SongRowSkeleton, EmptyState } from "@/components/ui/loading-skeleton";
import { toast } from "sonner";
import ShareMenu, { buildShareUrl } from "@/components/share/ShareMenu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SongRowSkeleton, EmptyState } from "@/components/ui/loading-skeleton";
import { toast } from "sonner";

const Playlists = () => {
  const { user } = useAuth();
  const { playSong, playQueue, currentSong, isPlaying } = usePlayer();
  const queryClient = useQueryClient();
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

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
    queryKey: ["admin-playlists"],
    queryFn: async () => {
      const { data: adminRoles } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      if (!adminRoles || adminRoles.length === 0) return [];
      const adminIds = adminRoles.map(r => r.user_id);
      const { data, error } = await supabase
        .from("playlists")
        .select("id, name, cover_url, created_at, user_id, playlist_songs(id, song_id, sort_order, songs(id, title, artist, cover_url, audio_url, instrumental_url, lyrics_lrc, duration_seconds, album))")
        .in("user_id", adminIds)
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

    return (
      <div key={pl.id} className="rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <ListMusic className="w-5 h-5 text-primary shrink-0" />
            {isEditing ? (
              <form onSubmit={(e) => { e.preventDefault(); renamePlaylist(pl.id, editName); }} className="flex items-center gap-1 flex-1">
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
          </div>
          <div className="flex gap-1 shrink-0">
            <ShareMenu
              url={buildShareUrl(`/playlists?id=${pl.id}`)}
              title={pl.name}
              text={`Check out this playlist: ${pl.name}`}
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
        {songs.length > 0 ? (
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
                      <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
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
      <div className="h-8" />
    </AppLayout>
  );
};

export default Playlists;
