import { useState, useEffect, memo, useCallback } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Search, Play, Heart, Plus, Music, ListMusic, Trash2, Shuffle, Download, Lock, Crown, WifiOff, ListPlus, Disc3 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { usePlayer, type PlayerSong } from "@/contexts/PlayerContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { SongRowSkeleton, EmptyState } from "@/components/ui/loading-skeleton";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useIsPremium } from "@/hooks/useIsPremium";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { getDownloadedMeta, getDownloadedAudioUrl, getDownloadedInstrumentalUrl, saveDownload, removeDownload, type DownloadedTrack } from "@/lib/downloadManager";
import { checkPlaybackAllowed, revalidateLicense, setTrackLicense } from "@/lib/offlineLicense";
import { useSearchParams, useNavigate } from "react-router-dom";
import AddToPlaylistModal from "@/components/playlist/AddToPlaylistModal";
import { sortSongsByTitle, compareTitles } from "@/lib/utils";
import { fuzzyMatch, lyricsSnippet } from "@/lib/fuzzySearch";
import Highlight from "@/components/search/Highlight";


type SongRow = {
  id: string;
  title: string;
  artist: string;
  cover_url: string | null;
  audio_url: string | null;
  instrumental_url: string | null;
  lyrics_lrc: string | null;
  lyrics_text?: string | null;
  duration_seconds: number;
  album: string | null;
  is_free_download?: boolean;
};

const Library = () => {
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") || "all";
  const [tab, setTab] = useState(defaultTab);
  const [search, setSearch] = useState("");
  const searchPlaceholder =
    tab === "albums" ? "Search album titles..."
    : tab === "playlists" ? "Search playlists, songs, lyrics, artists..."
    : tab === "downloads" ? "Search downloaded songs & lyrics..."
    : "Search songs, lyrics, artists...";

  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const navigate = useNavigate();
  const { playSong, playQueue, currentSong, isPlaying } = usePlayer();
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { isPremium } = useIsPremium();
  const isOnline = useOnlineStatus();
  const queryClient = useQueryClient();

  const canDownload = isPremium;

  // Downloads state
  const [downloads, setDownloads] = useState<DownloadedTrack[]>([]);
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [addToPlaylistSong, setAddToPlaylistSong] = useState<{ id: string; title: string } | null>(null);

  const loadDownloads = useCallback(async () => {
    const dl = await getDownloadedMeta();
    setDownloads(dl);
  }, []);

  useEffect(() => { loadDownloads(); }, [loadDownloads]);

  // Free download songs
  const { data: freeDownloadSongs = [] } = useQuery({
    queryKey: ["free-download-songs"],
    enabled: isOnline,
    queryFn: async () => {
      const { data } = await supabase.from("songs").select("id, title, artist, cover_url, audio_url, instrumental_url, lyrics_lrc, lyrics_text, duration_seconds, album, is_free_download").eq("is_free_download", true);
      return sortSongsByTitle((data || []) as SongRow[]);
    },
  });

  // Fetch all songs
  const { data: songs = [], isLoading: loadingSongs } = useQuery({
    queryKey: ["library-songs"],
    enabled: isOnline,
    queryFn: async () => {
      const { data, error } = await supabase.from("songs").select("id, title, artist, cover_url, audio_url, instrumental_url, lyrics_lrc, lyrics_text, duration_seconds, album, is_free_download").order("title");
      if (error) throw error;
      return sortSongsByTitle((data || []) as SongRow[]);
    },
  });

  // Fetch favorites
  const { data: favorites = [], isLoading: loadingFavs } = useQuery({
    queryKey: ["library-favorites", user?.id],
    enabled: !!user && isOnline,
    queryFn: async () => {
      const { data, error } = await supabase.from("favorites").select("id, song_id, songs(id, title, artist, cover_url, audio_url, instrumental_url, lyrics_lrc, lyrics_text, duration_seconds, album)").eq("user_id", user!.id);
      if (error) throw error;
      return (data as any[]).sort((a, b) => compareTitles(a.songs?.title, b.songs?.title));
    },
  });

  // Fetch playlists
  const { data: playlists = [], isLoading: loadingPlaylists } = useQuery({
    queryKey: ["library-playlists", user?.id],
    enabled: !!user && isOnline,
    queryFn: async () => {
      const { data, error } = await supabase.from("playlists").select("id, name, cover_url, created_at, playlist_songs(id, song_id, songs(id, title, artist, cover_url, audio_url, instrumental_url, lyrics_lrc, lyrics_text, duration_seconds, album))").eq("user_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch albums
  const { data: albums = [], isLoading: loadingAlbums } = useQuery({
    queryKey: ["library-albums"],
    enabled: isOnline,
    queryFn: async () => {
      const { data, error } = await supabase.from("albums").select("*").order("title");
      if (error) throw error;
      return sortSongsByTitle((data as any[]) || []) as any[];
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
  const isDownloadedTrack = (songId: string) => downloads.some(d => d.id === songId);

  const handleDownload = async (song: SongRow) => {
    if (!song.audio_url) { toast.error("No audio available"); return; }
    if (!canDownload && !song.is_free_download) {
      setShowUpgradeModal(true);
      return;
    }
    setDownloadingIds(prev => new Set(prev).add(song.id));
    try {
      await saveDownload(song.id, song.audio_url, {
        id: song.id,
        title: song.title,
        artist: song.artist,
        coverUrl: song.cover_url ?? undefined,
        lyricsLrc: song.lyrics_lrc ?? undefined,
        durationSeconds: song.duration_seconds,
        album: song.album ?? undefined,
        isFreeDownload: song.is_free_download,
        downloadedAt: Date.now(),
      }, song.instrumental_url ?? undefined);

      // Set offline license if premium (not free download)
      if (!song.is_free_download && user) {
        const { data: subData } = await supabase.from("user_subscriptions")
          .select("subscription_expiry_date")
          .eq("user_id", user.id)
          .single();
        const expiry = (subData as any)?.subscription_expiry_date;
        if (expiry) {
          setTrackLicense(song.id, expiry);
        }
      }

      await loadDownloads();
      toast.success(`"${song.title}" downloaded for offline play`);
    } catch (err: any) {
      toast.error("Download failed: " + (err.message || "Unknown error"));
    } finally {
      setDownloadingIds(prev => { const n = new Set(prev); n.delete(song.id); return n; });
    }
  };

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleRemoveDownload = async (songId: string) => {
    await removeDownload(songId);
    await loadDownloads();
    setConfirmDeleteId(null);
    toast.success("Download removed");
  };

  const playOfflineTrack = async (track: DownloadedTrack) => {
    // Check offline license
    const check = checkPlaybackAllowed(track.id);
    if (check.allowed === false) {
      if (check.reason === "needs_validation" && isOnline && user) {
        const recheck = await revalidateLicense(track.id, user.id);
        if (recheck.allowed === false) {
          toast.error(recheck.message);
          return;
        }
      } else {
        toast.error(check.message);
        if (check.reason === "expired") navigate("/subscription");
        return;
      }
    }

    const url = await getDownloadedAudioUrl(track.id);
    if (!url) { toast.error("Audio not found in downloads"); return; }
    const instrumentalUrl = await getDownloadedInstrumentalUrl(track.id);
    playSong({
      id: track.id,
      title: track.title,
      artist: track.artist,
      coverUrl: track.coverUrl,
      audioUrl: url,
      instrumentalUrl: instrumentalUrl || undefined,
      lyricsLrc: track.lyricsLrc,
      durationSeconds: track.durationSeconds,
    });
  };

  const q = search.trim();

  const matchesSong = (s: any) =>
    !q || fuzzyMatch(q, [s.title, s.artist, s.album, s.lyrics_text, s.lyrics_lrc]);

  const filtered = songs.filter(matchesSong);

  const filteredAlbums = albums.filter((a: any) => !q || fuzzyMatch(q, [a.title]));

  const filteredPlaylists = playlists.filter((pl: any) =>
    !q ||
    fuzzyMatch(q, [pl.name]) ||
    (pl.playlist_songs || []).some((ps: any) => ps.songs && matchesSong(ps.songs))
  );

  const filteredDownloads = downloads.filter((t) =>
    !q || fuzzyMatch(q, [t.title, t.artist, t.album, t.lyricsLrc])
  );



  const SongRowItem = memo(({ song, index, songList, showDownload = true }: { song: SongRow; index: number; songList: PlayerSong[]; showDownload?: boolean }) => (
    <button
      onClick={() => playQueue(songList, index)}
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
      <div className="flex items-center gap-1">
        {showDownload && song.audio_url && (
          isDownloadedTrack(song.id) ? (
            <span className="text-[10px] bg-green-500/20 text-green-600 px-1.5 py-0.5 rounded-full font-medium">Saved</span>
          ) : canDownload || song.is_free_download ? (
            <button
              onClick={(e) => { e.stopPropagation(); handleDownload(song); }}
              disabled={downloadingIds.has(song.id)}
              className="p-2 touch-target"
            >
              <Download className={`w-4 h-4 ${downloadingIds.has(song.id) ? "animate-pulse text-gold" : "text-muted-foreground"}`} />
            </button>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); setShowUpgradeModal(true); }}
              className="flex items-center gap-1 px-2 py-1 rounded-full bg-gold/10 text-gold text-[10px] font-semibold opacity-70"
            >
              <Download className="w-3 h-3" /> Premium
            </button>
          )
        )}
        {user && (
          <button
            onClick={(e) => { e.stopPropagation(); setAddToPlaylistSong({ id: song.id, title: song.title }); }}
            className="p-2 touch-target"
          >
            <ListPlus className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
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
            <div className="w-0.5 h-2 bg-gold rounded-full animate-pulse" />
            <div className="w-0.5 h-3 bg-gold rounded-full animate-pulse" style={{ animationDelay: "0.15s" }} />
            <div className="w-0.5 h-4 bg-gold rounded-full animate-pulse" style={{ animationDelay: "0.3s" }} />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold via-gold-light to-gold flex items-center justify-center shadow-[0_2px_12px_hsl(43_70%_53%/0.4)] ring-1 ring-white/20">
            <Play className="w-3.5 h-3.5 text-white ml-0.5 drop-shadow-sm" fill="currentColor" />
          </div>
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
            type="text" placeholder={searchPlaceholder}
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full bg-muted/50 mb-4 overflow-x-auto flex-nowrap justify-start lg:justify-center">
            <TabsTrigger value="all" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">All Songs</TabsTrigger>
            <TabsTrigger value="albums" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1">
              <Disc3 className="w-3.5 h-3.5" /> Albums
            </TabsTrigger>
            <TabsTrigger value="favorites" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Favorites</TabsTrigger>
            <TabsTrigger value="playlists" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Playlists</TabsTrigger>
            <TabsTrigger value="downloads" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1">
              <Download className="w-3.5 h-3.5" /> Downloads
            </TabsTrigger>
          </TabsList>

          {/* All Songs */}
          <TabsContent value="all">
            {!isOnline ? (
              <EmptyState icon={WifiOff} title="You're offline" description="Go to Downloads to play your saved tracks" />
            ) : loadingSongs ? (
              <div className="space-y-1">{Array.from({ length: 6 }).map((_, i) => <SongRowSkeleton key={i} />)}</div>
            ) : filtered.length === 0 ? (
              <EmptyState icon={Music} title="No songs found" description="Try a different search term" />
            ) : (
              <>
                {songs.length > 1 && (
                  <Button
                    variant="outline"
                    className="mb-4 w-full gap-2 touch-target border-gold/30 text-gold hover:bg-gold/10"
                    onClick={() => {
                      const shuffled = [...songs].sort(() => Math.random() - 0.5);
                      playQueue(shuffled.map(toPlayerSong));
                    }}
                  >
                    <Shuffle className="w-4 h-4" /> Shuffle All ({songs.length} songs)
                  </Button>
                )}
                <div className="space-y-1">{filtered.map((song, i) => <SongRowItem key={song.id} song={song} index={i} songList={filtered.map(toPlayerSong)} />)}</div>
              </>
            )}
          </TabsContent>

          {/* Albums */}
          <TabsContent value="albums">
            {!isOnline ? (
              <EmptyState icon={WifiOff} title="You're offline" description="Connect to browse albums" />
            ) : loadingAlbums ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="aspect-square rounded-xl bg-muted mb-2" />
                    <div className="h-3 bg-muted rounded w-3/4 mb-1" />
                    <div className="h-2 bg-muted rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : filteredAlbums.length === 0 ? (
              <EmptyState icon={Disc3} title="No albums found" description={search ? "Try a different search" : "No albums available yet"} />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {filteredAlbums
                  .map((album: any) => (
                    <button
                      key={album.id}
                      onClick={() => navigate(`/albums?id=${album.id}`)}
                      className="group text-left animate-fade-in-up touch-target"
                    >
                      <div className="relative aspect-square rounded-xl overflow-hidden mb-2 glass-card transition-all duration-300 group-hover:shadow-[0_8px_32px_hsl(43_70%_53%/0.12)]">
                        {album.cover_url ? (
                          <img src={album.cover_url} alt={album.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                        ) : (
                          <div className="w-full h-full gradient-purple flex items-center justify-center"><Disc3 className="w-10 h-10 text-gold/30" /></div>
                        )}
                        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold via-gold-light to-gold flex items-center justify-center shadow-[0_4px_20px_hsl(43_70%_53%/0.5)] ring-2 ring-white/20">
                            <Play className="w-4 h-4 text-white ml-0.5 drop-shadow-sm" fill="currentColor" />
                          </div>
                        </div>
                      </div>
                      <p className="text-sm font-medium text-foreground truncate group-hover:text-gold transition-colors">{album.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{album.artist}</p>
                    </button>
                  ))}
              </div>
            )}
          </TabsContent>


          {/* Favorites */}
          <TabsContent value="favorites">
            {!user ? (
              <EmptyState icon={Heart} title="Sign in to see your favorites" description="Create an account to save your favorite songs" />
            ) : !isOnline ? (
              <EmptyState icon={WifiOff} title="You're offline" description="Go to Downloads to play your saved tracks" />
            ) : loadingFavs ? (
              <div className="space-y-1">{Array.from({ length: 4 }).map((_, i) => <SongRowSkeleton key={i} />)}</div>
            ) : favorites.length === 0 ? (
              <EmptyState icon={Heart} title="No favorites yet" description="Tap the heart on any song to save it here" />
            ) : (
              <div className="space-y-1">
                {(() => { const favSongList = favorites.filter((f: any) => f.songs).map((f: any) => toPlayerSong(f.songs)); return favorites.map((fav: any, i: number) => fav.songs && <SongRowItem key={fav.id} song={fav.songs} index={i} songList={favSongList} />); })()}
              </div>
            )}
          </TabsContent>

          {/* Playlists */}
          <TabsContent value="playlists">
            {!user ? (
              <EmptyState icon={ListMusic} title="Sign in to create playlists" description="Create an account to organize your music" />
            ) : !isOnline ? (
              <EmptyState icon={WifiOff} title="You're offline" description="Go to Downloads to play your saved tracks" />
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
                ) : filteredPlaylists.length === 0 ? (
                  <EmptyState icon={ListMusic} title={playlists.length === 0 ? "No playlists yet" : "No playlists found"} description={playlists.length === 0 ? "Create your first playlist above" : "Try a different search term"} />

                ) : (
                  <div className="space-y-4">
                    {filteredPlaylists.map((pl: any) => {
                      const plMatchesName = q ? pl.name.toLowerCase().includes(q) : false;
                      const visibleSongs = (pl.playlist_songs || []).filter((ps: any) => ps.songs && (!q || plMatchesName || matchesSong(ps.songs)));
                      return (
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
                        {visibleSongs.length > 0 ? (
                          <div className="space-y-1">
                            {(() => { const plSongs = visibleSongs.map((ps: any) => toPlayerSong(ps.songs)); return visibleSongs.map((ps: any, i: number) => <SongRowItem key={ps.id} song={ps.songs} index={i} songList={plSongs} />); })()}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">{q ? "No matching songs in this playlist" : "No songs in this playlist"}</p>
                        )}
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* Downloads */}
          <TabsContent value="downloads">
            {/* Free download songs section (when online) */}
            {isOnline && freeDownloadSongs.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <Download className="w-4 h-4 text-green-500" /> Free Downloads
                </h3>
                <div className="space-y-1">
                  {freeDownloadSongs.filter(s => !isDownloadedTrack(s.id)).map((song, i) => (
                    <div key={song.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/60">
                      {song.cover_url ? (
                        <img src={song.cover_url} alt={song.title} className="w-10 h-10 rounded-lg object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                          <Music className="w-4 h-4 text-primary" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{song.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                      </div>
                      <span className="text-[10px] bg-green-500/20 text-green-600 px-1.5 py-0.5 rounded-full font-semibold">FREE</span>
                      <button
                        onClick={() => handleDownload(song)}
                        disabled={downloadingIds.has(song.id)}
                        className="p-2 text-green-600 hover:bg-green-500/10 rounded-lg"
                      >
                        <Download className={`w-4 h-4 ${downloadingIds.has(song.id) ? "animate-pulse" : ""}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Downloaded tracks */}
            {filteredDownloads.length === 0 ? (
              <EmptyState icon={Download} title={downloads.length === 0 ? "No downloads yet" : "No downloads found"} description={downloads.length === 0 ? (canDownload ? "Download songs to play them offline" : "Upgrade to Premium to download songs for offline playback") : "Try a different search term"} />
            ) : (
              <div className="space-y-1">
                {filteredDownloads.map((track) => (
                  <div key={track.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/60">
                    {track.coverUrl ? (
                      <img src={track.coverUrl} alt={track.title} className="w-12 h-12 rounded-lg object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
                        <Music className="w-5 h-5 text-primary" />
                      </div>
                    )}
                    <button onClick={() => playOfflineTrack(track)} className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-medium text-foreground truncate">{track.title}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground truncate">{track.artist} • {formatDuration(track.durationSeconds)}</p>
                        {track.isFreeDownload && <span className="text-[9px] bg-green-500/20 text-green-600 px-1 py-0.5 rounded font-semibold">FREE</span>}
                      </div>
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(track.id)}
                      className="p-2 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => playOfflineTrack(track)} className="w-8 h-8 rounded-full bg-gradient-to-br from-gold via-gold-light to-gold flex items-center justify-center shadow-[0_2px_12px_hsl(43_70%_53%/0.4)]">
                      <Play className="w-3.5 h-3.5 text-white ml-0.5" fill="currentColor" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Upgrade modal */}
      {showUpgradeModal && (
        <Dialog open={showUpgradeModal} onOpenChange={setShowUpgradeModal}>
          <DialogContent className="max-w-sm text-center">
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="w-16 h-16 rounded-full bg-gold/20 flex items-center justify-center">
                <Crown className="w-8 h-8 text-gold" />
              </div>
              <h3 className="text-xl font-serif font-bold text-foreground">Upgrade to Premium</h3>
              <p className="text-sm text-muted-foreground">Download songs for offline playback, access karaoke mode, and more — starting at just 2 Espees/month!</p>
              <Button className="gradient-gold text-primary-foreground w-full" onClick={() => { setShowUpgradeModal(false); navigate("/subscription"); }}>
                View Plans
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setShowUpgradeModal(false)}>
                Maybe Later
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Confirm delete download */}
      <AlertDialog open={!!confirmDeleteId} onOpenChange={(open) => { if (!open) setConfirmDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Download?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the track from your device. You can download it again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDeleteId && handleRemoveDownload(confirmDeleteId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {addToPlaylistSong && (
        <AddToPlaylistModal
          open={!!addToPlaylistSong}
          onOpenChange={(open) => { if (!open) setAddToPlaylistSong(null); }}
          songId={addToPlaylistSong.id}
          songTitle={addToPlaylistSong.title}
        />
      )}

      <div className="h-8" />
    </AppLayout>
  );
};

export default Library;
