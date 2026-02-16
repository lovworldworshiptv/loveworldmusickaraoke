import { useState, useEffect, useRef, useCallback } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Music, Upload, Save, Plus, Trash2, Edit3, X, Play, Pause, Square, MousePointer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Song {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  audio_url: string | null;
  instrumental_url: string | null;
  cover_url: string | null;
  lyrics_lrc: string | null;
  duration_seconds: number;
  is_featured: boolean;
  is_top: boolean;
  category_id: string | null;
}

const AdminSongs = () => {
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [editMode, setEditMode] = useState<"lrc" | "sync" | "details">("lrc");
  const [lrcText, setLrcText] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "", artist: "", album: "", duration_seconds: 240,
    is_featured: false, is_top: false, audio_url: "", instrumental_url: "", lyrics_raw: "",
  });
  // Edit details form
  const [editForm, setEditForm] = useState({
    title: "", artist: "", album: "", duration_seconds: 240,
    is_featured: false, is_top: false, audio_url: "", instrumental_url: "",
  });

  // Sync state
  const [syncLines, setSyncLines] = useState<string[]>([]);
  const [syncTimestamps, setSyncTimestamps] = useState<number[]>([]);
  const [syncCurrentLine, setSyncCurrentLine] = useState(0);
  const [syncPlaying, setSyncPlaying] = useState(false);
  const syncAudioRef = useRef<HTMLAudioElement | null>(null);
  const [syncTime, setSyncTime] = useState(0);

  useEffect(() => { fetchSongs(); }, []);

  const fetchSongs = async () => {
    const { data } = await supabase.from("songs").select("*").order("created_at", { ascending: false });
    if (data) setSongs(data);
    setLoading(false);
  };

  const handleSaveLyrics = async () => {
    if (!editingSong) return;
    const { error } = await supabase.from("songs").update({ lyrics_lrc: lrcText }).eq("id", editingSong.id);
    if (error) { toast.error("Failed to save lyrics"); return; }
    toast.success("Lyrics saved!");
    setEditingSong(null);
    fetchSongs();
  };

  const handleUploadCover = async (songId: string, file: File) => {
    const ext = file.name.split(".").pop();
    const path = `${songId}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("song-covers").upload(path, file, { upsert: true });
    if (uploadError) { toast.error("Upload failed: " + uploadError.message); return; }
    const { data: { publicUrl } } = supabase.storage.from("song-covers").getPublicUrl(path);
    await supabase.from("songs").update({ cover_url: publicUrl }).eq("id", songId);
    toast.success("Cover uploaded!");
    fetchSongs();
  };

  const handleCreateSong = async () => {
    const { error } = await supabase.from("songs").insert({
      title: form.title, artist: form.artist, album: form.album || null,
      duration_seconds: form.duration_seconds, is_featured: form.is_featured,
      is_top: form.is_top, audio_url: form.audio_url || null,
      instrumental_url: form.instrumental_url || null,
      lyrics_lrc: form.lyrics_raw || null,
    });
    if (error) { toast.error("Failed: " + error.message); return; }
    toast.success("Song created!");
    setShowForm(false);
    setForm({ title: "", artist: "", album: "", duration_seconds: 240, is_featured: false, is_top: false, audio_url: "", instrumental_url: "", lyrics_raw: "" });
    fetchSongs();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this song?")) return;
    await supabase.from("songs").delete().eq("id", id);
    toast.success("Deleted");
    fetchSongs();
  };

  const handleUpdateDetails = async () => {
    if (!editingSong) return;
    const { error } = await supabase.from("songs").update({
      title: editForm.title, artist: editForm.artist, album: editForm.album || null,
      duration_seconds: editForm.duration_seconds, is_featured: editForm.is_featured,
      is_top: editForm.is_top, audio_url: editForm.audio_url || null,
      instrumental_url: editForm.instrumental_url || null,
    }).eq("id", editingSong.id);
    if (error) { toast.error("Failed: " + error.message); return; }
    toast.success("Song updated!");
    setEditingSong(null);
    fetchSongs();
  };

  // --- Sync lyrics ---
  const startSync = () => {
    // Parse raw lyrics (without timestamps) into lines
    const rawLrc = lrcText || "";
    // Strip any existing timestamps
    const lines = rawLrc.split("\n").map(l => l.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, "").trim()).filter(Boolean);
    setSyncLines(lines);
    setSyncTimestamps(new Array(lines.length).fill(-1));
    setSyncCurrentLine(0);
    setEditMode("sync");

    // Start playing instrumental
    const url = editingSong?.instrumental_url || editingSong?.audio_url;
    if (url) {
      const audio = new Audio(url);
      syncAudioRef.current = audio;
      audio.play();
      setSyncPlaying(true);
      const interval = setInterval(() => {
        if (audio.paused || audio.ended) { clearInterval(interval); setSyncPlaying(false); return; }
        setSyncTime(audio.currentTime);
      }, 100);
    }
  };

  const handleSyncClick = (lineIndex: number) => {
    if (!syncAudioRef.current) return;
    const time = syncAudioRef.current.currentTime;
    setSyncTimestamps(prev => {
      const n = [...prev];
      n[lineIndex] = time;
      return n;
    });
    setSyncCurrentLine(lineIndex + 1);
  };

  const stopSync = () => {
    if (syncAudioRef.current) { syncAudioRef.current.pause(); syncAudioRef.current = null; }
    setSyncPlaying(false);
  };

  const saveSyncedLyrics = async () => {
    stopSync();
    // Build LRC
    const lrc = syncLines.map((line, i) => {
      const t = syncTimestamps[i];
      if (t < 0) return `[00:00.00]${line}`;
      const min = Math.floor(t / 60).toString().padStart(2, "0");
      const sec = Math.floor(t % 60).toString().padStart(2, "0");
      const ms = Math.round((t % 1) * 100).toString().padStart(2, "0");
      return `[${min}:${sec}.${ms}]${line}`;
    }).join("\n");

    setLrcText(lrc);
    if (editingSong) {
      const { error } = await supabase.from("songs").update({ lyrics_lrc: lrc }).eq("id", editingSong.id);
      if (error) toast.error("Failed to save");
      else toast.success("Synced lyrics saved!");
    }
    setEditMode("lrc");
    fetchSongs();
  };

  const openEdit = (song: Song, mode: "lrc" | "details") => {
    setEditingSong(song);
    setEditMode(mode);
    if (mode === "lrc") {
      setLrcText(song.lyrics_lrc || "");
    } else {
      setEditForm({
        title: song.title, artist: song.artist, album: song.album || "",
        duration_seconds: song.duration_seconds, is_featured: song.is_featured,
        is_top: song.is_top, audio_url: song.audio_url || "", instrumental_url: song.instrumental_url || "",
      });
    }
  };

  const formatSyncTime = (t: number) => {
    if (t < 0) return "--:--";
    const m = Math.floor(t / 60).toString().padStart(2, "0");
    const s = Math.floor(t % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  if (adminLoading) return <AppLayout><div className="p-6 text-center text-muted-foreground">Loading...</div></AppLayout>;
  if (!isAdmin) return <AppLayout><div className="p-6 text-center text-muted-foreground">Admin access required.</div></AppLayout>;

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 lg:pt-6 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-serif font-bold text-foreground">Manage Songs</h2>
          <Button onClick={() => setShowForm(!showForm)} className="gradient-gold text-primary-foreground gap-2">
            <Plus className="w-4 h-4" /> Add Song
          </Button>
        </div>

        {/* Create Song Form */}
        {showForm && (
          <div className="glass-card p-5 mb-6 space-y-4">
            <h3 className="font-serif font-bold text-foreground">New Song</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
              <input placeholder="Artist" value={form.artist} onChange={e => setForm({ ...form, artist: e.target.value })}
                className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
              <input placeholder="Album" value={form.album} onChange={e => setForm({ ...form, album: e.target.value })}
                className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
              <input placeholder="Duration (seconds)" type="number" value={form.duration_seconds}
                onChange={e => setForm({ ...form, duration_seconds: Number(e.target.value) })}
                className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
              <input placeholder="Audio URL" value={form.audio_url} onChange={e => setForm({ ...form, audio_url: e.target.value })}
                className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
              <input placeholder="Instrumental URL" value={form.instrumental_url} onChange={e => setForm({ ...form, instrumental_url: e.target.value })}
                className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
            </div>
            <textarea placeholder="Lyrics (plain text, one line per verse line)" value={form.lyrics_raw}
              onChange={e => setForm({ ...form, lyrics_raw: e.target.value })}
              className="w-full min-h-[120px] px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm font-mono resize-y" />
            <div className="flex gap-3">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={form.is_top} onChange={e => setForm({ ...form, is_top: e.target.checked })} /> Top Song
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={form.is_featured} onChange={e => setForm({ ...form, is_featured: e.target.checked })} /> Featured
              </label>
            </div>
            <Button onClick={handleCreateSong} className="gradient-gold text-primary-foreground">Create Song</Button>
          </div>
        )}

        {/* Edit Modal */}
        {editingSong && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="glass-card p-6 w-full max-w-2xl max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-serif font-bold text-foreground">
                  {editMode === "details" ? "Edit Song" : editMode === "sync" ? "Sync Lyrics" : "Edit Lyrics"} — {editingSong.title}
                </h3>
                <button onClick={() => { setEditingSong(null); stopSync(); }} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Mode tabs */}
              {editMode !== "sync" && (
                <div className="flex gap-1 mb-4">
                  <button onClick={() => setEditMode("details")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium ${editMode === "details" ? "gradient-gold text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    Details
                  </button>
                  <button onClick={() => { setEditMode("lrc"); setLrcText(editingSong.lyrics_lrc || ""); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium ${editMode === "lrc" ? "gradient-gold text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    Lyrics
                  </button>
                </div>
              )}

              {/* Details edit */}
              {editMode === "details" && (
                <div className="space-y-3 overflow-y-auto flex-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input placeholder="Title" value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                      className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
                    <input placeholder="Artist" value={editForm.artist} onChange={e => setEditForm({ ...editForm, artist: e.target.value })}
                      className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
                    <input placeholder="Album" value={editForm.album} onChange={e => setEditForm({ ...editForm, album: e.target.value })}
                      className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
                    <input placeholder="Duration (seconds)" type="number" value={editForm.duration_seconds}
                      onChange={e => setEditForm({ ...editForm, duration_seconds: Number(e.target.value) })}
                      className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
                    <input placeholder="Audio URL" value={editForm.audio_url} onChange={e => setEditForm({ ...editForm, audio_url: e.target.value })}
                      className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
                    <input placeholder="Instrumental URL" value={editForm.instrumental_url} onChange={e => setEditForm({ ...editForm, instrumental_url: e.target.value })}
                      className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
                  </div>
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <input type="checkbox" checked={editForm.is_top} onChange={e => setEditForm({ ...editForm, is_top: e.target.checked })} /> Top Song
                    </label>
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <input type="checkbox" checked={editForm.is_featured} onChange={e => setEditForm({ ...editForm, is_featured: e.target.checked })} /> Featured
                    </label>
                  </div>
                  <Button onClick={handleUpdateDetails} className="gradient-gold text-primary-foreground gap-2">
                    <Save className="w-4 h-4" /> Save Changes
                  </Button>
                </div>
              )}

              {/* LRC editor */}
              {editMode === "lrc" && (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-muted-foreground">
                      Enter lyrics (with or without timestamps). Use "Sync Lyrics" to time them to audio.
                    </p>
                    <Button onClick={startSync} size="sm" variant="outline" className="gap-1.5 text-gold border-gold/30">
                      <MousePointer className="w-3.5 h-3.5" /> Sync Lyrics
                    </Button>
                  </div>
                  <textarea
                    value={lrcText}
                    onChange={e => setLrcText(e.target.value)}
                    placeholder="Enter lyrics line by line...&#10;Amazing grace how sweet the sound&#10;That saved a wretch like me"
                    className="flex-1 min-h-[300px] px-4 py-3 rounded-lg bg-muted border border-border text-foreground font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <Button onClick={handleSaveLyrics} className="mt-4 gradient-gold text-primary-foreground gap-2 self-end">
                    <Save className="w-4 h-4" /> Save Lyrics
                  </Button>
                </>
              )}

              {/* Sync mode */}
              {editMode === "sync" && (
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex items-center gap-3 mb-4 glass-card px-4 py-3">
                    <div className="flex items-center gap-2">
                      {syncPlaying ? (
                        <button onClick={stopSync} className="p-1.5 rounded-lg bg-destructive/20 text-destructive">
                          <Square className="w-4 h-4" />
                        </button>
                      ) : (
                        <button onClick={startSync} className="p-1.5 rounded-lg bg-gold/20 text-gold">
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <span className="text-sm text-foreground font-mono">{formatSyncTime(syncTime)}</span>
                    <span className="text-xs text-muted-foreground flex-1">Click each line as the audio plays to sync it</span>
                    <Button onClick={saveSyncedLyrics} size="sm" className="gradient-gold text-primary-foreground gap-1">
                      <Save className="w-3.5 h-3.5" /> Save
                    </Button>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-1">
                    {syncLines.map((line, i) => {
                      const isActive = i === syncCurrentLine;
                      const isSynced = syncTimestamps[i] >= 0;
                      return (
                        <button
                          key={i}
                          onClick={() => handleSyncClick(i)}
                          className={`w-full text-left px-4 py-2.5 rounded-lg flex items-center gap-3 transition-all ${
                            isActive
                              ? "bg-gold/20 border border-gold/40 text-gold"
                              : isSynced
                              ? "bg-muted/40 text-foreground"
                              : "text-muted-foreground hover:bg-muted/30"
                          }`}
                        >
                          <span className="text-[10px] font-mono w-10 text-right flex-shrink-0">
                            {isSynced ? formatSyncTime(syncTimestamps[i]) : "—"}
                          </span>
                          <span className="text-sm">{line}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Songs List */}
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading...</p>
        ) : songs.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">No songs yet. Add your first song above.</p>
        ) : (
          <div className="space-y-2">
            {songs.map(song => (
              <div key={song.id} className="glass-card p-4 flex items-center gap-4">
                {/* Cover */}
                <div className="w-14 h-14 rounded-lg gradient-purple flex-shrink-0 overflow-hidden flex items-center justify-center relative group">
                  {song.cover_url ? (
                    <img src={song.cover_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Music className="w-6 h-6 text-gold/40" />
                  )}
                  <label className="absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <Upload className="w-4 h-4 text-foreground" />
                    <input type="file" accept="image/*" className="hidden"
                      onChange={e => { if (e.target.files?.[0]) handleUploadCover(song.id, e.target.files[0]); }} />
                  </label>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{song.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{song.artist} {song.album ? `• ${song.album}` : ""}</p>
                  <div className="flex gap-2 mt-1">
                    {song.lyrics_lrc && <span className="text-[10px] bg-gold/20 text-gold px-1.5 py-0.5 rounded">LRC</span>}
                    {song.is_top && <span className="text-[10px] bg-accent/30 text-accent-foreground px-1.5 py-0.5 rounded">Top</span>}
                    {song.is_featured && <span className="text-[10px] bg-accent/30 text-accent-foreground px-1.5 py-0.5 rounded">Featured</span>}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button onClick={() => openEdit(song, "details")}
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-gold transition-colors" title="Edit Details">
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button onClick={() => openEdit(song, "lrc")}
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-gold transition-colors" title="Edit Lyrics">
                    <Music className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(song.id)}
                    className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="h-8" />
    </AppLayout>
  );
};

export default AdminSongs;