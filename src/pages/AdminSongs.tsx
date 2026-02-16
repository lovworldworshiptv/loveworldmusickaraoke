import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Music, Upload, Save, Plus, Trash2, Edit3, X } from "lucide-react";
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
  const [lrcText, setLrcText] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "", artist: "", album: "", duration_seconds: 240,
    is_featured: false, is_top: false, audio_url: "", instrumental_url: "",
  });

  useEffect(() => {
    fetchSongs();
  }, []);

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
    });
    if (error) { toast.error("Failed: " + error.message); return; }
    toast.success("Song created!");
    setShowForm(false);
    setForm({ title: "", artist: "", album: "", duration_seconds: 240, is_featured: false, is_top: false, audio_url: "", instrumental_url: "" });
    fetchSongs();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this song?")) return;
    await supabase.from("songs").delete().eq("id", id);
    toast.success("Deleted");
    fetchSongs();
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

        {/* LRC Editor Modal */}
        {editingSong && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="glass-card p-6 w-full max-w-2xl max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-serif font-bold text-foreground">Edit Lyrics — {editingSong.title}</h3>
                <button onClick={() => setEditingSong(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Use LRC format with timestamps. Example:<br />
                <code className="text-gold">[00:12.50]Amazing grace how sweet the sound</code><br />
                <code className="text-gold">[00:18.20]That saved a wretch like me</code>
              </p>
              <textarea
                value={lrcText}
                onChange={e => setLrcText(e.target.value)}
                placeholder="[00:00.00]Title&#10;[00:05.00]First line of lyrics&#10;[00:10.00]Second line..."
                className="flex-1 min-h-[300px] px-4 py-3 rounded-lg bg-muted border border-border text-foreground font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <Button onClick={handleSaveLyrics} className="mt-4 gradient-gold text-primary-foreground gap-2 self-end">
                <Save className="w-4 h-4" /> Save Lyrics
              </Button>
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
                  <button onClick={() => { setEditingSong(song); setLrcText(song.lyrics_lrc || ""); }}
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-gold transition-colors" title="Edit Lyrics">
                    <Edit3 className="w-4 h-4" />
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
