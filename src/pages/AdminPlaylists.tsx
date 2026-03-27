import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useAuth } from "@/contexts/AuthContext";
import { ListMusic, Plus, Trash2, Edit3, X, Save, Music, Search, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface Playlist {
  id: string;
  name: string;
  user_id: string;
  cover_url: string | null;
  created_at: string;
  is_visible_on_homepage: boolean;
  profile_username?: string;
  song_count?: number;
}

interface Song {
  id: string;
  title: string;
  artist: string;
  cover_url: string | null;
}

const AdminPlaylists = () => {
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const { user } = useAuth();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Create playlist
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newVisibleOnHomepage, setNewVisibleOnHomepage] = useState(false);

  // Edit playlist
  const [editing, setEditing] = useState<Playlist | null>(null);
  const [editName, setEditName] = useState("");

  // Add songs dialog
  const [addingSongsTo, setAddingSongsTo] = useState<string | null>(null);
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [playlistSongIds, setPlaylistSongIds] = useState<Set<string>>(new Set());
  const [songSearch, setSongSearch] = useState("");

  useEffect(() => {
    fetchPlaylists();
  }, []);

  const fetchPlaylists = async () => {
    // Fetch admin user IDs so we only show admin-created (global) playlists
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    const adminUserIds = new Set((adminRoles || []).map((r) => r.user_id));

    const { data: playlistData } = await supabase
      .from("playlists")
      .select("id, name, user_id, cover_url, created_at, is_visible_on_homepage")
      .order("created_at", { ascending: false });

    if (!playlistData) {
      setLoading(false);
      return;
    }

    // Only show playlists created by admin users
    const adminPlaylists = playlistData.filter((p) => adminUserIds.has(p.user_id));

    const userIds = [...new Set(adminPlaylists.map((p) => p.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, username")
      .in("user_id", userIds);

    const profileMap: Record<string, string> = {};
    (profiles || []).forEach((p) => {
      profileMap[p.user_id] = p.username;
    });

    const playlistIds = adminPlaylists.map((p) => p.id);
    const { data: songCounts } = await supabase
      .from("playlist_songs")
      .select("playlist_id")
      .in("playlist_id", playlistIds);

    const countMap: Record<string, number> = {};
    (songCounts || []).forEach((ps) => {
      countMap[ps.playlist_id] = (countMap[ps.playlist_id] || 0) + 1;
    });

    setPlaylists(
      adminPlaylists.map((p) => ({
        ...p,
        profile_username: profileMap[p.user_id] || "Unknown",
        song_count: countMap[p.id] || 0,
      })),
    );
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!newName.trim() || !user) return;

    const { error } = await supabase.from("playlists").insert({
      name: newName.trim(),
      user_id: user.id,
      is_visible_on_homepage: newVisibleOnHomepage,
    } as any);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`Playlist "${newName.trim()}" created as Loveworld Singers!`);
    setNewName("");
    setNewVisibleOnHomepage(false);
    setShowCreate(false);
    fetchPlaylists();
  };

  const handleUpdate = async () => {
    if (!editing || !editName.trim()) return;

    const { error } = await supabase
      .from("playlists")
      .update({ name: editName.trim() })
      .eq("id", editing.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Playlist updated!");
    setEditing(null);
    fetchPlaylists();
  };

  const handleVisibilityToggle = async (playlistId: string, visible: boolean) => {
    const previous = playlists;
    setPlaylists((prev) => prev.map((pl) => (pl.id === playlistId ? { ...pl, is_visible_on_homepage: visible } : pl)));

    const { error } = await supabase
      .from("playlists")
      .update({ is_visible_on_homepage: visible } as any)
      .eq("id", playlistId);

    if (error) {
      setPlaylists(previous);
      toast.error(error.message);
      return;
    }

    toast.success(visible ? "Playlist is now visible on homepage" : "Playlist hidden from homepage");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this playlist and all its songs?")) return;

    await supabase.from("playlist_songs").delete().eq("playlist_id", id);
    await supabase.from("playlists").delete().eq("id", id);
    toast.success("Playlist deleted");
    fetchPlaylists();
  };

  const openAddSongs = async (playlistId: string) => {
    setAddingSongsTo(playlistId);
    setSongSearch("");

    const [{ data: songs }, { data: existing }] = await Promise.all([
      supabase.from("songs").select("id, title, artist, cover_url").order("title"),
      supabase.from("playlist_songs").select("song_id").eq("playlist_id", playlistId),
    ]);

    setAllSongs(songs || []);
    setPlaylistSongIds(new Set((existing || []).map((e) => e.song_id)));
  };

  const toggleSongInPlaylist = async (songId: string) => {
    if (!addingSongsTo) return;

    if (playlistSongIds.has(songId)) {
      await supabase.from("playlist_songs").delete().eq("playlist_id", addingSongsTo).eq("song_id", songId);
      setPlaylistSongIds((prev) => {
        const next = new Set(prev);
        next.delete(songId);
        return next;
      });
      return;
    }

    const { error } = await supabase.from("playlist_songs").insert({
      playlist_id: addingSongsTo,
      song_id: songId,
      sort_order: playlistSongIds.size,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    setPlaylistSongIds((prev) => new Set(prev).add(songId));
  };

  const filteredPlaylists = playlists.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.profile_username || "").toLowerCase().includes(search.toLowerCase()),
  );

  const filteredSongs = allSongs.filter(
    (s) =>
      s.title.toLowerCase().includes(songSearch.toLowerCase()) ||
      s.artist.toLowerCase().includes(songSearch.toLowerCase()),
  );

  if (adminLoading)
    return (
      <AppLayout>
        <div className="p-6 text-center text-muted-foreground">Loading...</div>
      </AppLayout>
    );

  if (!isAdmin)
    return (
      <AppLayout>
        <div className="p-6 text-center text-muted-foreground">Admin access required.</div>
      </AppLayout>
    );

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 lg:pt-6 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-serif font-bold text-foreground">Manage Playlists</h2>
          <Button onClick={() => setShowCreate(true)} className="gradient-gold text-primary-foreground gap-2">
            <Plus className="w-4 h-4" /> New Playlist
          </Button>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search playlists or users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {showCreate && (
          <div className="glass-card p-5 mb-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-serif font-bold text-foreground">New Official Playlist</h3>
              <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              This playlist will be created as <span className="text-gold font-medium">Loveworld Singers</span>
            </p>
            <div className="flex gap-2">
              <Input placeholder="Playlist name" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <Button onClick={handleCreate} className="gradient-gold text-primary-foreground gap-1">
                <Save className="w-4 h-4" /> Create
              </Button>
            </div>
            <label className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-foreground">
              <span>Show this playlist in Global Playlists on homepage</span>
              <Switch checked={newVisibleOnHomepage} onCheckedChange={setNewVisibleOnHomepage} />
            </label>
          </div>
        )}

        {editing && (
          <div className="glass-card p-5 mb-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-serif font-bold text-foreground">Edit Playlist</h3>
              <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex gap-2">
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              <Button onClick={handleUpdate} className="gradient-gold text-primary-foreground gap-1">
                <Save className="w-4 h-4" /> Save
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-muted-foreground text-sm">Loading...</p>
        ) : filteredPlaylists.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">No playlists found.</p>
        ) : (
          <div className="space-y-2">
            {filteredPlaylists.map((pl) => (
              <div key={pl.id} className="glass-card p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg gradient-purple flex items-center justify-center flex-shrink-0">
                  <ListMusic className="w-5 h-5 text-gold/40" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{pl.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <UserCircle className="w-3 h-3" />
                    <span className="truncate">{pl.profile_username}</span>
                    <span>•</span>
                    <span>{pl.song_count} songs</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-2 py-1">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Homepage</span>
                  <Switch
                    checked={pl.is_visible_on_homepage}
                    onCheckedChange={(checked) => handleVisibilityToggle(pl.id, checked)}
                  />
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openAddSongs(pl.id)}
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                    title="Add/remove songs"
                  >
                    <Music className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setEditing(pl);
                      setEditName(pl.name);
                    }}
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-gold transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(pl.id)}
                    className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={!!addingSongsTo}
        onOpenChange={() => {
          setAddingSongsTo(null);
          fetchPlaylists();
        }}
      >
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
                  className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-colors text-left ${
                    inPlaylist ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-muted/60"
                  }`}
                >
                  {song.cover_url ? (
                    <img src={song.cover_url} alt="" className="w-10 h-10 rounded object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-primary/20 flex items-center justify-center">
                      <Music className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate text-foreground">{song.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                  </div>
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      inPlaylist ? "bg-primary border-primary" : "border-muted-foreground"
                    }`}
                  >
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

export default AdminPlaylists;
