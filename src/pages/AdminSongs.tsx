import { useState, useEffect, useRef, useCallback } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useIsEditor } from "@/hooks/useIsEditor";
import { Music, Upload, Save, Plus, Trash2, Edit3, X, Play, Pause, Square, MousePointer, FileAudio, ChevronDown, Rewind, FastForward, Pencil, Check, CheckCircle, Wand2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import ImageUploadPicker from "@/components/admin/ImageUploadPicker";
import { sortSongsByTitle, compareTitles } from "@/lib/utils";
import { Video } from "lucide-react";
import SongVideosManager from "@/components/admin/SongVideosManager";

interface Song {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  album_id: string | null;
  audio_url: string | null;
  instrumental_url: string | null;
  cover_url: string | null;
  lyrics_lrc: string | null;
  duration_seconds: number;
  is_featured: boolean;
  is_top: boolean;
  is_free_download: boolean;
  category_id: string | null;
  has_video?: boolean;
}

interface AlbumOption {
  id: string;
  title: string;
}

interface PlaylistOption {
  id: string;
  name: string;
}

interface StorageFile {
  name: string;
  url: string;
}

// ── Audio picker: upload or choose existing ──
const AudioPicker = ({ bucket, label, value, onChange }: {
  bucket: string; label: string; value: string; onChange: (url: string) => void;
}) => {
  const [existing, setExisting] = useState<StorageFile[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchExisting = async () => {
    const { data } = await supabase.storage.from(bucket).list("", { limit: 200, sortBy: { column: "created_at", order: "desc" } });
    if (data) {
      setExisting(data.filter(f => !f.name.startsWith(".")).map(f => ({
        name: f.name,
        url: supabase.storage.from(bucket).getPublicUrl(f.name).data.publicUrl,
      })));
    }
  };

  useEffect(() => { fetchExisting(); }, [bucket]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    const path = `${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });
    if (error) { toast.error("Upload failed: " + error.message); setUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
    onChange(publicUrl);
    toast.success(`${label} uploaded!`);
    setUploading(false);
    setShowPicker(false);
    fetchExisting();
  };

  const selectedName = value ? decodeURIComponent(value.split("/").pop() || "") : "";

  return (
    <div className="space-y-1">
      <label className="text-xs text-muted-foreground font-medium">{label}</label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setShowPicker(!showPicker)}
          className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-muted border border-border text-sm text-left min-w-0"
        >
          <FileAudio className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className="truncate text-foreground">{selectedName || "No file selected"}</span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-auto flex-shrink-0" />
        </button>
        <label className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer ${uploading ? "opacity-50 pointer-events-none" : "gradient-gold text-primary-foreground"}`}>
          <Upload className="w-3.5 h-3.5" /> {uploading ? "..." : "Upload"}
          <input type="file" accept="audio/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); }} />
        </label>
      </div>

      {/* URL input fallback */}
      <input
        placeholder="Or paste URL directly"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-1.5 rounded-lg bg-muted border border-border text-foreground text-xs"
      />

      {showPicker && (
        <div className="border border-border rounded-lg bg-card max-h-48 overflow-y-auto">
          {existing.length === 0 ? (
            <p className="text-xs text-muted-foreground p-3 text-center">No files uploaded yet</p>
          ) : existing.map(f => (
            <button
              key={f.name}
              type="button"
              onClick={() => { onChange(f.url); setShowPicker(false); }}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors truncate ${value === f.url ? "bg-primary/10 text-primary" : "text-foreground"}`}
            >
              {f.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const AdminSongs = () => {
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const { isEditor, loading: editorLoading } = useIsEditor();
  const isEditorOnly = isEditor && !isAdmin;
  const [songs, setSongs] = useState<Song[]>([]);
  const [generating, setGenerating] = useState<Record<string, boolean>>({});

  const handleGenerateInstrumental = async (song: Song) => {
    if (song.instrumental_url && !confirm(`"${song.title}" already has an instrumental. Replace it?`)) return;
    setGenerating(g => ({ ...g, [song.id]: true }));
    const tId = toast.loading(`Removing vocals from "${song.title}"… this can take a few minutes.`);
    const call = async (body: Record<string, string>) => {
      const { data, error } = await supabase.functions.invoke("generate-instrumental", { body });
      if (error) {
        let msg = error.message;
        try { const ctx = await (error as any).context?.json(); msg = ctx?.error || msg; } catch {}
        throw new Error(typeof msg === "string" ? msg : "Request failed");
      }
      return data;
    };
    try {
      const start = await call({ action: "start", songId: song.id });
      const predictionId = start.predictionId;
      for (let i = 0; i < 180; i++) {
        await new Promise(r => setTimeout(r, i < 5 ? 4000 : 8000));
        const res = await call({ action: "check", songId: song.id, predictionId });
        if (res.status === "succeeded") {
          setSongs(prev => prev.map(s => s.id === song.id ? { ...s, instrumental_url: res.instrumentalUrl } : s));
          toast.success(`Instrumental ready for "${song.title}"`, { id: tId });
          return;
        }
        if (res.status === "failed" || res.status === "canceled") throw new Error(res.error || "Separation failed");
      }
      throw new Error("Timed out waiting for the instrumental");
    } catch (e: any) {
      toast.error(`Couldn't generate instrumental: ${e.message}`, { id: tId });
    } finally {
      setGenerating(g => { const n = { ...g }; delete n[song.id]; return n; });
    }
  };
  const [loading, setLoading] = useState(true);
  const [videoSong, setVideoSong] = useState<{ id: string; title: string } | null>(null);
  const fetchSongsRef = useRef<(() => void) | null>(null);
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [editMode, setEditMode] = useState<"lrc" | "sync" | "details">("lrc");
  const [lrcText, setLrcText] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "", artist: "Loveworld Singers", album: "", album_id: "", category_id: "", playlist_id: "", duration_seconds: 240,
    is_featured: false, is_top: false, is_free_download: false, audio_url: "", instrumental_url: "", lyrics_raw: "", cover_url: "",
  });
  const [editForm, setEditForm] = useState({
    title: "", artist: "", album: "", album_id: "", category_id: "", duration_seconds: 240,
    is_featured: false, is_top: false, is_free_download: false, audio_url: "", instrumental_url: "", cover_url: "",
  });
  const [albumOptions, setAlbumOptions] = useState<AlbumOption[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<{ id: string; name: string }[]>([]);
  const [playlistOptions, setPlaylistOptions] = useState<PlaylistOption[]>([]);

  // Auto-detect audio duration from URL
  const detectAudioDuration = (url: string, callback: (seconds: number) => void) => {
    if (!url) return;
    const audio = new Audio(url);
    audio.addEventListener("loadedmetadata", () => {
      if (audio.duration && isFinite(audio.duration)) {
        callback(Math.round(audio.duration));
      }
    });
  };

  // Sync state — each line can have multiple timestamps
  const [syncLines, setSyncLines] = useState<string[]>([]);
  const [syncTimestamps, setSyncTimestamps] = useState<number[][]>([]);
  const [syncCurrentLine, setSyncCurrentLine] = useState(0);
  const [syncPlaying, setSyncPlaying] = useState(false);
  const syncAudioRef = useRef<HTMLAudioElement | null>(null);
  const [syncTime, setSyncTime] = useState(0);
  const [syncDuration, setSyncDuration] = useState(0);
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);
  const [editingLineText, setEditingLineText] = useState("");
  const [bulkEditingLyrics, setBulkEditingLyrics] = useState(false);
  const [bulkLyricsText, setBulkLyricsText] = useState("");
  const [syncTrack, setSyncTrack] = useState<"audio" | "instrumental">("audio");

  useEffect(() => { fetchSongs(); fetchAlbumOptions(); fetchCategoryOptions(); fetchPlaylistOptions(); }, []);

  const fetchAlbumOptions = async () => {
    const { data } = await supabase.from("albums").select("id, title").order("title");
    if (data) setAlbumOptions(data);
  };

  const fetchCategoryOptions = async () => {
    const { data } = await supabase.from("categories").select("id, name").order("name");
    if (data) setCategoryOptions(data);
  };

  const fetchPlaylistOptions = async () => {
    const { data } = await supabase.from("playlists").select("id, name").order("created_at", { ascending: false });
    if (data) setPlaylistOptions(data);
  };

  const fetchSongs = async () => {
    const { data } = await supabase.from("songs").select("*").order("created_at", { ascending: false });
    if (data) setSongs(sortSongsByTitle(data));
    setLoading(false);
  };
  fetchSongsRef.current = fetchSongs;

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
    const { data: newSong, error } = await supabase.from("songs").insert({
      title: form.title, artist: form.artist, album: form.album || null,
      album_id: form.album_id || null, category_id: form.category_id || null,
      duration_seconds: form.duration_seconds, is_featured: form.is_featured,
      is_top: form.is_top, is_free_download: form.is_free_download, audio_url: form.audio_url || null,
      instrumental_url: form.instrumental_url || null,
      lyrics_lrc: form.lyrics_raw || null, cover_url: form.cover_url || null,
    }).select("id").single();

    if (error || !newSong) {
      toast.error("Failed: " + (error?.message || "Could not create song"));
      return;
    }

    if (form.playlist_id) {
      const { data: existingLink } = await supabase
        .from("playlist_songs")
        .select("id")
        .eq("playlist_id", form.playlist_id)
        .eq("song_id", newSong.id)
        .maybeSingle();

      if (!existingLink) {
        const { data: lastSong } = await supabase
          .from("playlist_songs")
          .select("sort_order")
          .eq("playlist_id", form.playlist_id)
          .order("sort_order", { ascending: false })
          .limit(1)
          .maybeSingle();

        const nextSortOrder = (lastSong?.sort_order ?? -1) + 1;
        const { error: playlistSongError } = await supabase.from("playlist_songs").insert({
          playlist_id: form.playlist_id,
          song_id: newSong.id,
          sort_order: nextSortOrder,
        });

        if (playlistSongError) {
          toast.error("Song created, but adding to playlist failed: " + playlistSongError.message);
        }
      }
    }

    toast.success("Song created!");
    setShowForm(false);
    setForm({ title: "", artist: "Loveworld Singers", album: "", album_id: "", category_id: "", playlist_id: "", duration_seconds: 240, is_featured: false, is_top: false, is_free_download: false, audio_url: "", instrumental_url: "", lyrics_raw: "", cover_url: "" });
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
      album_id: editForm.album_id || null, category_id: editForm.category_id || null,
      duration_seconds: editForm.duration_seconds, is_featured: editForm.is_featured,
      is_top: editForm.is_top, is_free_download: editForm.is_free_download, audio_url: editForm.audio_url || null,
      instrumental_url: editForm.instrumental_url || null, cover_url: editForm.cover_url || null,
    }).eq("id", editingSong.id);
    if (error) { toast.error("Failed: " + error.message); return; }
    toast.success("Song updated!");
    setEditingSong(null);
    fetchSongs();
  };

  // --- Sync lyrics ---
  const startSync = () => {
    const rawLrc = lrcText || "";
    const rawLines = rawLrc.split("\n").filter(l => l.trim());
    // Group timestamps by lyric text to support multi-timestamp lines
    const lineMap = new Map<string, number[]>();
    const orderedLines: string[] = [];
    for (const raw of rawLines) {
      const timestamps = [...raw.matchAll(/\[(\d{2}):(\d{2})\.(\d{2,3})\]/g)];
      const text = raw.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, "").trim();
      if (!text) continue;
      if (!lineMap.has(text)) {
        lineMap.set(text, []);
        orderedLines.push(text);
      }
      for (const m of timestamps) {
        const t = parseInt(m[1]) * 60 + parseFloat(`${m[2]}.${m[3]}`);
        lineMap.get(text)!.push(t);
      }
    }
    // Deduplicate lines, keep unique text order
    const uniqueLines = orderedLines.length > 0 ? orderedLines : rawLrc.split("\n").map(l => l.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, "").trim()).filter(Boolean);
    setSyncLines(uniqueLines);
    setSyncTimestamps(uniqueLines.map(l => (lineMap.get(l) || []).sort((a, b) => a - b)));
    setSyncCurrentLine(0);
    setEditMode("sync");

    const url = syncTrack === "instrumental" && editingSong?.instrumental_url
      ? editingSong.instrumental_url
      : editingSong?.audio_url;
    if (url) {
      const audio = new Audio(url);
      syncAudioRef.current = audio;
      audio.addEventListener("loadedmetadata", () => setSyncDuration(audio.duration || 0));
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
      const n = prev.map(arr => [...arr]);
      n[lineIndex] = [...n[lineIndex], time].sort((a, b) => a - b);
      return n;
    });
    // Only auto-advance if line had no timestamps yet
    if (syncTimestamps[lineIndex]?.length === 0) {
      setSyncCurrentLine(lineIndex + 1);
    }
  };

  const handleRemoveTimestamp = (lineIndex: number, tsIndex: number) => {
    setSyncTimestamps(prev => {
      const n = prev.map(arr => [...arr]);
      n[lineIndex] = n[lineIndex].filter((_, i) => i !== tsIndex);
      return n;
    });
  };

  const stopSync = () => {
    if (syncAudioRef.current) { syncAudioRef.current.pause(); syncAudioRef.current = null; }
    setSyncPlaying(false);
  };

  const formatTimestamp = (t: number) => {
    const min = Math.floor(t / 60).toString().padStart(2, "0");
    const sec = Math.floor(t % 60).toString().padStart(2, "0");
    const ms = Math.round((t % 1) * 100).toString().padStart(2, "0");
    return `[${min}:${sec}.${ms}]`;
  };

  const saveSyncedLyrics = async () => {
    stopSync();
    const lrcLines: string[] = [];
    syncLines.forEach((line, i) => {
      const stamps = syncTimestamps[i];
      if (!stamps || stamps.length === 0) {
        lrcLines.push(`[00:00.00]${line}`);
      } else {
        // Each timestamp gets its own LRC line with the same text
        stamps.forEach(t => {
          lrcLines.push(`${formatTimestamp(t)}${line}`);
        });
      }
    });
    // Sort all lines by timestamp for proper LRC playback
    const lrc = lrcLines.sort((a, b) => {
      const timeA = parseFloat(a.match(/\[(\d+):(\d+\.\d+)\]/)?.slice(1).reduce((acc, v, i) => i === 0 ? parseFloat(v) * 60 : acc + parseFloat(v), 0) + "" || "0");
      const timeB = parseFloat(b.match(/\[(\d+):(\d+\.\d+)\]/)?.slice(1).reduce((acc, v, i) => i === 0 ? parseFloat(v) * 60 : acc + parseFloat(v), 0) + "" || "0");
      return timeA - timeB;
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
        album_id: song.album_id || "", category_id: song.category_id || "",
        duration_seconds: song.duration_seconds, is_featured: song.is_featured,
        is_top: song.is_top, is_free_download: song.is_free_download, audio_url: song.audio_url || "", instrumental_url: song.instrumental_url || "",
        cover_url: song.cover_url || "",
      });
    }
  };

  const formatSyncTime = (t: number) => {
    if (t < 0) return "--:--";
    const m = Math.floor(t / 60).toString().padStart(2, "0");
    const s = Math.floor(t % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  if (adminLoading || editorLoading) return <AppLayout><div className="p-6 text-center text-muted-foreground">Loading...</div></AppLayout>;
  if (!isAdmin && !isEditor) return <AppLayout><div className="p-6 text-center text-muted-foreground">Admin or Editor access required.</div></AppLayout>;

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 lg:pt-6 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-serif font-bold text-foreground">Manage Songs</h2>
          {!isEditorOnly && (
            <Button onClick={() => setShowForm(!showForm)} className="gradient-gold text-primary-foreground gap-2">
              <Plus className="w-4 h-4" /> Add Song
            </Button>
          )}
        </div>

        {/* Create Song Form */}
        {showForm && !isEditorOnly && (
          <div className="glass-card p-5 mb-6 space-y-4">
            <h3 className="font-serif font-bold text-foreground">New Song</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
              <input placeholder="Artist" value={form.artist} onChange={e => setForm({ ...form, artist: e.target.value })}
                className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
              <select value={form.album_id} onChange={e => {
                const sel = albumOptions.find(a => a.id === e.target.value);
                setForm({ ...form, album_id: e.target.value, album: sel?.title || form.album });
              }} className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm">
                <option value="">No Album</option>
                {albumOptions.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
              </select>
              <select value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}
                className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm">
                <option value="">No Category</option>
                {categoryOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={form.playlist_id} onChange={e => setForm({ ...form, playlist_id: e.target.value })}
                className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm">
                <option value="">No Playlist</option>
                {playlistOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input placeholder="Duration (seconds)" type="number" value={form.duration_seconds}
                onChange={e => setForm({ ...form, duration_seconds: Number(e.target.value) })}
                className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
            </div>

            <ImageUploadPicker bucket="song-covers" label="Cover Image" value={form.cover_url} onChange={url => setForm({ ...form, cover_url: url })} />
            <AudioPicker bucket="song-audio" label="Audio File" value={form.audio_url} onChange={url => { setForm(f => ({ ...f, audio_url: url })); detectAudioDuration(url, sec => setForm(f => ({ ...f, duration_seconds: sec }))); }} />
            <AudioPicker bucket="song-instrumentals" label="Instrumental File" value={form.instrumental_url} onChange={url => setForm({ ...form, instrumental_url: url })} />

            <textarea placeholder="Lyrics (plain text, one line per verse line)" value={form.lyrics_raw}
              onChange={e => setForm({ ...form, lyrics_raw: e.target.value })}
              className="w-full min-h-[120px] px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm font-mono resize-y" />
            <div className="flex gap-3 flex-wrap">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={form.is_top} onChange={e => setForm({ ...form, is_top: e.target.checked })} /> Top Song
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={form.is_featured} onChange={e => setForm({ ...form, is_featured: e.target.checked })} /> Featured
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={form.is_free_download} onChange={e => setForm({ ...form, is_free_download: e.target.checked })} /> Free Download
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
                    <select value={editForm.album_id} onChange={e => {
                      const sel = albumOptions.find(a => a.id === e.target.value);
                      setEditForm({ ...editForm, album_id: e.target.value, album: sel?.title || editForm.album });
                    }} className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm">
                      <option value="">No Album</option>
                      {albumOptions.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
                    </select>
                    <select value={editForm.category_id} onChange={e => setEditForm({ ...editForm, category_id: e.target.value })}
                      className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm">
                      <option value="">No Category</option>
                      {categoryOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <input placeholder="Duration (seconds)" type="number" value={editForm.duration_seconds}
                      onChange={e => setEditForm({ ...editForm, duration_seconds: Number(e.target.value) })}
                      className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
                  </div>

                  <ImageUploadPicker bucket="song-covers" label="Cover Image" value={editForm.cover_url} onChange={url => setEditForm({ ...editForm, cover_url: url })} />
                  <AudioPicker bucket="song-audio" label="Audio File" value={editForm.audio_url} onChange={url => { setEditForm(f => ({ ...f, audio_url: url })); detectAudioDuration(url, sec => setEditForm(f => ({ ...f, duration_seconds: sec }))); }} />
                  <AudioPicker bucket="song-instrumentals" label="Instrumental File" value={editForm.instrumental_url} onChange={url => setEditForm({ ...editForm, instrumental_url: url })} />

                  <div className="flex gap-3 flex-wrap">
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <input type="checkbox" checked={editForm.is_top} onChange={e => setEditForm({ ...editForm, is_top: e.target.checked })} /> Top Song
                    </label>
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <input type="checkbox" checked={editForm.is_featured} onChange={e => setEditForm({ ...editForm, is_featured: e.target.checked })} /> Featured
                    </label>
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <input type="checkbox" checked={editForm.is_free_download} onChange={e => setEditForm({ ...editForm, is_free_download: e.target.checked })} /> Free Download
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
                  <div className="flex items-center justify-between mb-3 gap-2">
                    <p className="text-xs text-muted-foreground">
                      Enter lyrics (with or without timestamps). Use "Sync Lyrics" to time them to audio.
                    </p>
                    <div className="flex items-center gap-2">
                      {editingSong?.instrumental_url && (
                        <select
                          value={syncTrack}
                          onChange={e => setSyncTrack(e.target.value as "audio" | "instrumental")}
                          className="text-xs rounded-md border border-border bg-muted px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          <option value="audio">Audio Track</option>
                          <option value="instrumental">Instrumental</option>
                        </select>
                      )}
                      <Button onClick={startSync} size="sm" variant="outline" className="gap-1.5 text-gold border-gold/30">
                        <MousePointer className="w-3.5 h-3.5" /> Sync Lyrics
                      </Button>
                    </div>
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
                  <div className="flex flex-col gap-2 mb-4 glass-card px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => { if (syncAudioRef.current) { syncAudioRef.current.currentTime = Math.max(0, syncAudioRef.current.currentTime - 5); setSyncTime(syncAudioRef.current.currentTime); } }}
                          className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground" title="Rewind 5s">
                          <Rewind className="w-4 h-4" />
                        </button>
                        {syncPlaying ? (
                          <button onClick={() => { syncAudioRef.current?.pause(); setSyncPlaying(false); }} className="p-1.5 rounded-lg bg-gold/20 text-gold" title="Pause">
                            <Pause className="w-4 h-4" />
                          </button>
                        ) : (
                          <button onClick={() => { if (syncAudioRef.current) { syncAudioRef.current.play(); setSyncPlaying(true); const interval = setInterval(() => { if (!syncAudioRef.current || syncAudioRef.current.paused || syncAudioRef.current.ended) { clearInterval(interval); setSyncPlaying(false); return; } setSyncTime(syncAudioRef.current.currentTime); }, 100); } else { startSync(); } }} className="p-1.5 rounded-lg bg-gold/20 text-gold" title="Play">
                            <Play className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={stopSync} className="p-1.5 rounded-lg bg-destructive/20 text-destructive" title="Stop">
                          <Square className="w-4 h-4" />
                        </button>
                        <button onClick={() => { if (syncAudioRef.current) { syncAudioRef.current.currentTime = Math.min(syncDuration, syncAudioRef.current.currentTime + 5); setSyncTime(syncAudioRef.current.currentTime); } }}
                          className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground" title="Forward 5s">
                          <FastForward className="w-4 h-4" />
                        </button>
                      </div>
                      <span className="text-sm text-foreground font-mono">{formatSyncTime(syncTime)}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">/ {formatSyncTime(syncDuration)}</span>
                      {editingSong?.instrumental_url && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {syncTrack === "instrumental" ? "♪ Instrumental" : "♪ Audio"}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground flex-1">Click a line to stamp — click again for multiples</span>
                      <Button onClick={() => { setBulkLyricsText(syncLines.join("\n")); setBulkEditingLyrics(true); }} size="sm" variant="outline" className="gap-1 text-xs border-border">
                        <Edit3 className="w-3 h-3" /> Edit All
                      </Button>
                      <Button onClick={saveSyncedLyrics} size="sm" className="gradient-gold text-primary-foreground gap-1">
                        <Save className="w-3.5 h-3.5" /> Save
                      </Button>
                    </div>
                    {/* Seekable timeline */}
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={0}
                        max={syncDuration || 1}
                        step={0.1}
                        value={syncTime}
                        onChange={e => {
                          const t = parseFloat(e.target.value);
                          if (syncAudioRef.current) syncAudioRef.current.currentTime = t;
                          setSyncTime(t);
                        }}
                        className="flex-1 h-2 accent-gold cursor-pointer"
                      />
                    </div>
                  </div>
                  {bulkEditingLyrics && (
                    <div className="mb-3 glass-card p-4 space-y-3">
                      <p className="text-xs text-muted-foreground">Edit all lyrics below — one line per row. Add or remove lines as needed. Timestamps for unchanged lines will be preserved.</p>
                      <textarea
                        value={bulkLyricsText}
                        onChange={e => setBulkLyricsText(e.target.value)}
                        className="w-full min-h-[200px] px-3 py-2 rounded-lg bg-muted border border-border text-foreground font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary"
                        autoFocus
                      />
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="outline" onClick={() => setBulkEditingLyrics(false)}>Cancel</Button>
                        <Button size="sm" className="gradient-gold text-primary-foreground" onClick={() => {
                          const newLines = bulkLyricsText.split("\n").filter(l => l.trim());
                          // Build a map of old line text -> timestamps for preservation
                          const oldMap = new Map<string, number[]>();
                          syncLines.forEach((l, i) => {
                            if (!oldMap.has(l) && syncTimestamps[i]?.length > 0) {
                              oldMap.set(l, syncTimestamps[i]);
                            }
                          });
                          const newTimestamps = newLines.map(l => oldMap.get(l) || []);
                          setSyncLines(newLines);
                          setSyncTimestamps(newTimestamps);
                          setSyncCurrentLine(0);
                          setBulkEditingLyrics(false);
                          toast.success("Lyrics updated");
                        }}>Apply Changes</Button>
                      </div>
                    </div>
                  )}
                  <div className="flex-1 overflow-y-auto space-y-1">
                    {syncLines.map((line, i) => {
                      const isActive = i === syncCurrentLine;
                      const stamps = syncTimestamps[i] || [];
                      const isSynced = stamps.length > 0;
                      const isEditing = editingLineIndex === i;
                      return (
                        <div key={i} className="flex flex-col">
                          <div className={`w-full px-4 py-2.5 rounded-lg flex items-center gap-3 transition-all ${
                            isActive
                              ? "bg-gold/20 border border-gold/40 text-gold"
                              : isSynced
                              ? "bg-muted/40 text-foreground"
                              : "text-muted-foreground hover:bg-muted/30"
                          }`}>
                            <span className="text-[10px] font-mono w-16 text-right flex-shrink-0">
                              {isSynced ? stamps.map(t => formatSyncTime(t)).join(", ") : "—"}
                            </span>
                            {isEditing ? (
                              <input
                                autoFocus
                                value={editingLineText}
                                onChange={e => setEditingLineText(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === "Enter") {
                                    setSyncLines(prev => { const n = [...prev]; n[i] = editingLineText; return n; });
                                    setEditingLineIndex(null);
                                  } else if (e.key === "Escape") {
                                    setEditingLineIndex(null);
                                  }
                                }}
                                className="flex-1 text-sm bg-background border border-border rounded px-2 py-0.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                            ) : (
                              <button
                                onClick={() => handleSyncClick(i)}
                                className="text-sm flex-1 text-left"
                              >
                                {line}
                              </button>
                            )}
                            {stamps.length > 1 && (
                              <span className="text-[9px] bg-gold/20 text-gold px-1.5 py-0.5 rounded-full">{stamps.length}×</span>
                            )}
                            {isEditing ? (
                              <button
                                onClick={() => { setSyncLines(prev => { const n = [...prev]; n[i] = editingLineText; return n; }); setEditingLineIndex(null); }}
                                className="p-1 rounded text-primary hover:bg-primary/10"
                                title="Confirm edit"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditingLineIndex(i); setEditingLineText(line); }}
                                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                title="Edit line"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          {stamps.length > 0 && (
                            <div className="flex flex-wrap gap-1 ml-20 mt-1 mb-1">
                              {stamps.map((t, ti) => (
                                <span
                                  key={ti}
                                  className="inline-flex items-center gap-1 text-[9px] font-mono bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded"
                                >
                                  {formatSyncTime(t)}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleRemoveTimestamp(i, ti); }}
                                    className="text-destructive/60 hover:text-destructive"
                                  >
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
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

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{song.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{song.artist} {song.album ? `• ${song.album}` : ""}</p>
                  <div className="flex gap-2 mt-1">
                    {song.audio_url && <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded">Audio</span>}
                    {song.instrumental_url && <span className="text-[10px] bg-accent/20 text-accent-foreground px-1.5 py-0.5 rounded">Instrumental</span>}
                    {song.lyrics_lrc && <span className="text-[10px] bg-gold/20 text-gold px-1.5 py-0.5 rounded">LRC</span>}
                    {song.is_top && <span className="text-[10px] bg-accent/30 text-accent-foreground px-1.5 py-0.5 rounded">Top</span>}
                    {song.is_featured && <span className="text-[10px] bg-accent/30 text-accent-foreground px-1.5 py-0.5 rounded">Featured</span>}
                    {song.is_free_download && <span className="text-[10px] bg-green-500/20 text-green-600 px-1.5 py-0.5 rounded">Free DL</span>}
                  </div>
                </div>

                <div className="flex gap-2">
                  {isAdmin && song.audio_url && (
                    <button onClick={() => handleGenerateInstrumental(song)}
                      disabled={!!generating[song.id]}
                      className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-gold transition-colors disabled:opacity-60"
                      title={song.instrumental_url ? "Regenerate Instrumental" : "Generate Instrumental"}
                      aria-label="Generate Instrumental">
                      {generating[song.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                    </button>
                  )}
                  <button onClick={() => openEdit(song, "details")}
                    className={`p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-gold transition-colors ${isEditorOnly ? "opacity-30 pointer-events-none" : ""}`} title="Edit Details"
                    disabled={isEditorOnly}>
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button onClick={() => openEdit(song, "lrc")}
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-gold transition-colors relative" title="Edit Lyrics">
                    <Music className="w-4 h-4" />
                    {song.lyrics_lrc && /\[\d{2}:\d{2}\.\d{2,3}\]/.test(song.lyrics_lrc) && (
                      <CheckCircle className="w-3 h-3 text-green-500 absolute -top-0.5 -right-0.5" />
                    )}
                  </button>
                  {!isEditorOnly && (
                    <button onClick={() => setVideoSong({ id: song.id, title: song.title })}
                      className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-gold transition-colors relative" title="Manage Videos">
                      <Video className="w-4 h-4" />
                      {song.has_video && <CheckCircle className="w-3 h-3 text-green-500 absolute -top-0.5 -right-0.5" />}
                    </button>
                  )}
                  <button onClick={() => handleDelete(song.id)}
                    className={`p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors ${isEditorOnly ? "opacity-30 pointer-events-none" : ""}`} title="Delete"
                    disabled={isEditorOnly}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="h-8" />
      <SongVideosManager
        songId={videoSong?.id ?? null}
        songTitle={videoSong?.title}
        onClose={() => { setVideoSong(null); fetchSongsRef.current?.(); }}
      />
    </AppLayout>
  );
};

export default AdminSongs;
