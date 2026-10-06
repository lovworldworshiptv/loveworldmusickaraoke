import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Disc3, Plus, Trash2, Edit3, X, Save, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import ImageUploadPicker from "@/components/admin/ImageUploadPicker";

interface Album {
  id: string;
  title: string;
  artist: string;
  cover_url: string | null;
  is_top: boolean;
  created_at: string;
}

const AdminAlbums = () => {
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Album | null>(null);
  const [form, setForm] = useState({ title: "", artist: "Loveworld Singers", is_top: false, cover_url: "" });

  useEffect(() => { fetchAlbums(); }, []);

  const fetchAlbums = async () => {
    const { data } = await supabase.from("albums").select("*").order("created_at", { ascending: false });
    if (data) setAlbums(data);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!form.title) { toast.error("Title required"); return; }
    const { error } = await supabase.from("albums").insert({ title: form.title, artist: form.artist, is_top: form.is_top, cover_url: form.cover_url || null });
    if (error) { toast.error(error.message); return; }
    toast.success("Album created!");
    setShowForm(false);
    setForm({ title: "", artist: "", is_top: false, cover_url: "" });
    fetchAlbums();
  };

  const handleUpdate = async () => {
    if (!editing) return;
    const { error } = await supabase.from("albums").update({ title: form.title, artist: form.artist, is_top: form.is_top, cover_url: form.cover_url || null }).eq("id", editing.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Album updated!");
    setEditing(null);
    fetchAlbums();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this album? Songs will be unlinked.")) return;
    await supabase.from("albums").delete().eq("id", id);
    toast.success("Deleted");
    fetchAlbums();
  };

  const handleUploadCover = async (albumId: string, file: File) => {
    const ext = file.name.split(".").pop();
    const path = `${albumId}.${ext}`;
    const { error } = await supabase.storage.from("album-covers").upload(path, file, { upsert: true });
    if (error) { toast.error("Upload failed: " + error.message); return; }
    const { data: { publicUrl } } = supabase.storage.from("album-covers").getPublicUrl(path);
    await supabase.from("albums").update({ cover_url: publicUrl }).eq("id", albumId);
    toast.success("Cover uploaded!");
    fetchAlbums();
  };

  const openEdit = (album: Album) => {
    setEditing(album);
    setForm({ title: album.title, artist: album.artist, is_top: album.is_top, cover_url: album.cover_url || "" });
  };

  if (adminLoading) return <AppLayout><div className="p-6 text-center text-muted-foreground">Loading...</div></AppLayout>;
  if (!isAdmin) return <AppLayout><div className="p-6 text-center text-muted-foreground">Admin access required.</div></AppLayout>;

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 lg:pt-6 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-serif font-bold text-foreground">Manage Albums</h2>
          <Button onClick={() => { setShowForm(!showForm); setEditing(null); }} className="gradient-gold text-primary-foreground gap-2">
            <Plus className="w-4 h-4" /> Add Album
          </Button>
        </div>

        {/* Create / Edit Form */}
        {(showForm || editing) && (
          <div className="glass-card p-5 mb-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif font-bold text-foreground">{editing ? "Edit Album" : "New Album"}</h3>
              <button onClick={() => { setShowForm(false); setEditing(null); }} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input placeholder="Album Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
              <input placeholder="Artist" value={form.artist} onChange={e => setForm({ ...form, artist: e.target.value })}
                className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
            </div>
            <ImageUploadPicker bucket="album-covers" label="Album Cover" value={form.cover_url} onChange={url => setForm({ ...form, cover_url: url })} />
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={form.is_top} onChange={e => setForm({ ...form, is_top: e.target.checked })} />
              Top Album (displayed on homepage)
            </label>
            <Button onClick={editing ? handleUpdate : handleCreate} className="gradient-gold text-primary-foreground gap-2">
              <Save className="w-4 h-4" /> {editing ? "Save Changes" : "Create Album"}
            </Button>
          </div>
        )}

        {/* Album List */}
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading...</p>
        ) : albums.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">No albums yet.</p>
        ) : (
          <div className="space-y-2">
            {albums.map(album => (
              <div key={album.id} className="glass-card p-4 flex items-center gap-4">
                <div className="w-14 h-14 rounded-lg gradient-purple flex-shrink-0 overflow-hidden flex items-center justify-center relative group">
                  {album.cover_url ? (
                    <img src={album.cover_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Disc3 className="w-6 h-6 text-gold/40" />
                  )}
                  <label className="absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <Upload className="w-4 h-4 text-foreground" />
                    <input type="file" accept="image/*" className="hidden"
                      onChange={e => { if (e.target.files?.[0]) handleUploadCover(album.id, e.target.files[0]); }} />
                  </label>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{album.title}</p>
                  <p className="text-xs text-foreground truncate">{album.artist}</p>
                  <div className="flex gap-2 mt-1">
                    {album.is_top && <span className="text-[10px] bg-gold/20 text-gold px-1.5 py-0.5 rounded">Top Album</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(album)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-gold transition-colors">
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(album.id)} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
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

export default AdminAlbums;
