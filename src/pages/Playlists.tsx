import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayer, type PlayerSong } from "@/contexts/PlayerContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ListMusic, Plus, Trash2, Play, Music, Shuffle } from "lucide-react";
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

  const { data: playlists = [], isLoading } = useQuery({
    queryKey: ["playlists-page", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("playlists")
        .select("id, name, cover_url, created_at, playlist_songs(id, song_id, sort_order, songs(id, title, artist, cover_url, audio_url, instrumental_url, lyrics_lrc, duration_seconds, album))")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
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

  const toPlayerSong = (s: any): PlayerSong => ({
    id: s.id, title: s.title, artist: s.artist, album: s.album || undefined,
    coverUrl: s.cover_url || undefined, audioUrl: s.audio_url || undefined,
    instrumentalUrl: s.instrumental_url || undefined, lyricsLrc: s.lyrics_lrc || undefined,
    durationSeconds: s.duration_seconds,
  });

  const formatDuration = (sec: number) => `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, "0")}`;

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

        {!user ? (
          <EmptyState icon={ListMusic} title="Sign in to create playlists" description="Create an account to organize your music" />
        ) : isLoading ? (
          <div className="space-y-1">{Array.from({ length: 4 }).map((_, i) => <SongRowSkeleton key={i} />)}</div>
        ) : playlists.length === 0 ? (
          <EmptyState icon={ListMusic} title="No playlists yet" description="Create your first playlist" />
        ) : (
          <div className="space-y-4">
            {playlists.map((pl: any) => {
              const songs = (pl.playlist_songs || []).filter((ps: any) => ps.songs).map((ps: any) => toPlayerSong(ps.songs));
              return (
                <div key={pl.id} className="rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <ListMusic className="w-5 h-5 text-primary" />
                      <h3 className="font-semibold text-foreground">{pl.name}</h3>
                      <span className="text-xs text-muted-foreground">({songs.length} songs)</span>
                    </div>
                    <div className="flex gap-2">
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
                      <button onClick={() => deletePlaylist.mutate(pl.id)} className="p-2 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {songs.length > 0 ? (
                    <div className="space-y-1">
                      {songs.map((song: PlayerSong, i: number) => {
                        const isActive = currentSong?.id === song.id;
                        return (
                          <button key={song.id} onClick={() => playQueue(songs, i)}
                            className={`flex items-center gap-3 w-full p-2 rounded-lg transition-colors ${isActive ? "bg-muted/80" : "hover:bg-muted/40"}`}>
                            {song.coverUrl ? (
                              <img src={song.coverUrl} alt="" className="w-10 h-10 rounded object-cover" />
                            ) : (
                              <div className="w-10 h-10 rounded bg-primary/20 flex items-center justify-center"><Music className="w-4 h-4 text-primary" /></div>
                            )}
                            <div className="flex-1 min-w-0 text-left">
                              <p className="text-sm truncate text-foreground">{song.title}</p>
                              <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                            </div>
                            <span className="text-xs text-muted-foreground">{formatDuration(song.durationSeconds || 0)}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No songs in this playlist</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="h-8" />
    </AppLayout>
  );
};

export default Playlists;
