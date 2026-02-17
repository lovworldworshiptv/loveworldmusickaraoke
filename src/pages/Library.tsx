import { useState, memo, useCallback } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Search, Play, Heart, Plus, Music, ListMusic, Trash2 } from "lucide-react";
import { usePlayer, type PlayerSong } from "@/contexts/PlayerContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { SongRowSkeleton, EmptyState } from "@/components/ui/loading-skeleton";

type SongRow = {
  id: string;
  title: string;
  artist: string;
  cover_url: string | null;
  audio_url: string | null;
  instrumental_url: string | null;
  lyrics_lrc: string | null;
  duration_seconds: number;
  album: string | null;
};

const Library = () => {
  const [search, setSearch] = useState("");
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { playSong, currentSong, isPlaying } = usePlayer();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all songs
  const { data: songs = [], isLoading: loadingSongs } = useQuery({
    queryKey: ["library-songs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("songs").select("id, title, artist, cover_url, audio_url, instrumental_url, lyrics_lrc, duration_seconds, album").order("title");
      if (error) throw error;
      return data as SongRow[];
    },
  });

  // Fetch favorites (with song details)
  const { data: favorites = [], isLoading: loadingFavs } = useQuery({
    queryKey: ["library-favorites", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("favorites").select("id, song_id, songs(id, title, artist, cover_url, audio_url, instrumental_url, lyrics_lrc, duration_seconds, album)").eq("user_id", user!.id);
      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch playlists
  const { data: playlists = [], isLoading: loadingPlaylists } = useQuery({
    queryKey: ["library-playlists", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("playlists").select("id, name, cover_url, created_at, playlist_songs(id, song_id, songs(id, title, artist, cover_url, audio_url, instrumental_url, lyrics_lrc, duration_seconds, album))").eq("user_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  // Toggle favorite
  const toggleFav = useMutation({
    mutationFn: async (songId: string) => {
      const existing = favorites.find((f: any) => f.song_id === songId);
      if (existing) {
        await supabase.from("favorites").delete().eq("id", existing.id);
      } else {
        await supabase.from("favorites").insert({ song_id: songId, user_id: user!.id });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["library-favorites"] }),
  });

  // Create playlist
  const createPlaylist = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("playlists").insert({ name, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library-playlists"] });
      setNewPlaylistName("");
      setDialogOpen(false);
      toast.success("Playlist created!");
    },
    onError: () => toast.error("Failed to create playlist"),
  });

  // Delete playlist
  const deletePlaylist = useMutation({
    mutationFn: async (playlistId: string) => {
      await supabase.from("playlist_songs").delete().eq("playlist_id", playlistId);
      await supabase.from("playlists").delete().eq("id", playlistId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library-playlists"] });
      toast.success("Playlist deleted");
    },
  });

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const toPlayerSong = (song: SongRow): PlayerSong => ({
    id: song.id,
    title: song.title,
    artist: song.artist,
    coverUrl: song.cover_url ?? undefined,
    audioUrl: song.audio_url ?? undefined,
    instrumentalUrl: song.instrumental_url ?? undefined,
    lyricsLrc: song.lyrics_lrc ?? undefined,
    durationSeconds: song.duration_seconds,
  });

  const isFavorited = (songId: string) => favorites.some((f: any) => f.song_id === songId);

  const filtered = songs.filter(
    (s) =>
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.artist.toLowerCase().includes(search.toLowerCase())
  );

  const SongRowItem = memo(({ song, index }: { song: SongRow; index: number }) => (
    <button
      onClick={() => playSong(toPlayerSong(song))}
      className={`flex items-center gap-3 w-full p-3 rounded-xl transition-all duration-200 active:scale-[0.98] hover:bg-muted/60 touch-target ${
        currentSong?.id === song.id ? "bg-muted/80 ring-1 ring-primary" : ""
      }`}
    >
      {song.cover_url ? (
        <img src={song.cover_url} alt={song.title} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" loading="lazy" />
      ) : (
        <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
          <Music className="w-5 h-5 text-primary" />
        </div>
      )}
      <div className="flex-1 min-w-0 text-left">
        <p className="text-sm font-medium text-foreground truncate">{song.title}</p>
        <p className="text-xs text-muted-foreground truncate">{song.artist} • {formatDuration(song.duration_seconds)}</p>
      </div>
      <div className="flex items-center gap-2">
        {user && (
          <button
            onClick={(e) => { e.stopPropagation(); toggleFav.mutate(song.id); }}
            className="p-2 touch-target"
          >
            <Heart className={`w-4 h-4 transition-colors ${isFavorited(song.id) ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
          </button>
        )}
        {currentSong?.id === song.id && isPlaying ? (
          <div className="flex gap-0.5 items-end h-4">
            <div className="w-0.5 h-2 bg-primary rounded-full animate-pulse" />
            <div className="w-0.5 h-3 bg-primary rounded-full animate-pulse" style={{ animationDelay: "0.15s" }} />
            <div className="w-0.5 h-4 bg-primary rounded-full animate-pulse" style={{ animationDelay: "0.3s" }} />
          </div>
        ) : (
          <Play className="w-4 h-4 text-primary" />
        )}
      </div>
    </button>
  ));

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 lg:pt-6">
        <h2 className="text-2xl font-serif font-bold text-foreground mb-4">My Library</h2>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text" placeholder="Search songs, artists..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <Tabs defaultValue="all">
          <TabsList className="w-full bg-muted/50 mb-4">
            <TabsTrigger value="all" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">All Songs</TabsTrigger>
            <TabsTrigger value="favorites" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Favorites</TabsTrigger>
            <TabsTrigger value="playlists" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Playlists</TabsTrigger>
          </TabsList>

          {/* All Songs */}
          <TabsContent value="all">
            {loadingSongs ? (
              <div className="space-y-1">{Array.from({ length: 6 }).map((_, i) => <SongRowSkeleton key={i} />)}</div>
            ) : filtered.length === 0 ? (
              <EmptyState icon={Music} title="No songs found" description="Try a different search term" />
            ) : (
              <div className="space-y-1">{filtered.map((song, i) => <SongRowItem key={song.id} song={song} index={i} />)}</div>
            )}
          </TabsContent>

          {/* Favorites */}
          <TabsContent value="favorites">
            {!user ? (
              <EmptyState icon={Heart} title="Sign in to see your favorites" description="Create an account to save your favorite songs" />
            ) : loadingFavs ? (
              <div className="space-y-1">{Array.from({ length: 4 }).map((_, i) => <SongRowSkeleton key={i} />)}</div>
            ) : favorites.length === 0 ? (
              <EmptyState icon={Heart} title="No favorites yet" description="Tap the heart on any song to save it here" />
            ) : (
              <div className="space-y-1">
                {favorites.map((fav: any, i: number) => fav.songs && <SongRowItem key={fav.id} song={fav.songs} index={i} />)}
              </div>
            )}
          </TabsContent>

          {/* Playlists */}
          <TabsContent value="playlists">
            {!user ? (
              <EmptyState icon={ListMusic} title="Sign in to create playlists" description="Create an account to organize your music" />
            ) : (
              <div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="mb-4 w-full gap-2 touch-target">
                      <Plus className="w-4 h-4" /> New Playlist
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Create Playlist</DialogTitle></DialogHeader>
                    <form onSubmit={(e) => { e.preventDefault(); if (newPlaylistName.trim()) createPlaylist.mutate(newPlaylistName.trim()); }} className="flex gap-2">
                      <Input placeholder="Playlist name" value={newPlaylistName} onChange={(e) => setNewPlaylistName(e.target.value)} />
                      <Button type="submit" disabled={!newPlaylistName.trim() || createPlaylist.isPending}>Create</Button>
                    </form>
                  </DialogContent>
                </Dialog>

                {loadingPlaylists ? (
                  <div className="space-y-1">{Array.from({ length: 3 }).map((_, i) => <SongRowSkeleton key={i} />)}</div>
                ) : playlists.length === 0 ? (
                  <EmptyState icon={ListMusic} title="No playlists yet" description="Create your first playlist above" />
                ) : (
                  <div className="space-y-4">
                    {playlists.map((pl: any) => (
                      <div key={pl.id} className="rounded-xl border border-border p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <ListMusic className="w-5 h-5 text-primary" />
                            <h3 className="font-semibold text-foreground">{pl.name}</h3>
                            <span className="text-xs text-muted-foreground">({pl.playlist_songs?.length ?? 0} songs)</span>
                          </div>
                          <button onClick={() => deletePlaylist.mutate(pl.id)} className="p-2 text-muted-foreground hover:text-destructive transition-colors touch-target">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        {pl.playlist_songs?.length > 0 ? (
                          <div className="space-y-1">
                            {pl.playlist_songs.map((ps: any, i: number) => ps.songs && <SongRowItem key={ps.id} song={ps.songs} index={i} />)}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">No songs in this playlist</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
      <div className="h-8" />
    </AppLayout>
  );
};

export default Library;
