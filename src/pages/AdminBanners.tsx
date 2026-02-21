import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Plus, Trash2, Edit3, Save, X, Eye, EyeOff, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import ImageUploadPicker from "@/components/admin/ImageUploadPicker";

interface HeroBanner {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  image_url: string | null;
  link_url: string | null;
  cta_text: string | null;
  show_cta: boolean;
  is_active: boolean;
  sort_order: number;
}

const AdminBanners = () => {
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [banners, setBanners] = useState<HeroBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<HeroBanner | null>(null);
  const [form, setForm] = useState({
    title: "", subtitle: "", description: "", image_url: "", link_url: "",
    cta_text: "Listen Now", show_cta: true, is_active: true, sort_order: 0,
  });

  useEffect(() => { fetchBanners(); }, []);

  const fetchBanners = async () => {
    const { data } = await supabase.from("hero_banners").select("*").order("sort_order");
    if (data) setBanners(data);
    setLoading(false);
  };

  const resetForm = () => {
    setForm({ title: "", subtitle: "", description: "", image_url: "", link_url: "", cta_text: "Listen Now", show_cta: true, is_active: true, sort_order: 0 });
    setEditing(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    const payload = {
      title: form.title,
      subtitle: form.subtitle || null,
      description: form.description || null,
      image_url: form.image_url || null,
      link_url: form.link_url || null,
      cta_text: form.cta_text || null,
      show_cta: form.show_cta,
      is_active: form.is_active,
      sort_order: form.sort_order,
    };
    if (editing) {
      const { error } = await supabase.from("hero_banners").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Banner updated!");
    } else {
      const { error } = await supabase.from("hero_banners").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Banner created!");
    }
    resetForm();
    fetchBanners();
  };

  const handleEdit = (banner: HeroBanner) => {
    setForm({
      title: banner.title, subtitle: banner.subtitle || "",
      description: banner.description || "",
      image_url: banner.image_url || "", link_url: banner.link_url || "",
      cta_text: banner.cta_text || "", show_cta: banner.show_cta,
      is_active: banner.is_active, sort_order: banner.sort_order,
    });
    setEditing(banner);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this banner?")) return;
    await supabase.from("hero_banners").delete().eq("id", id);
    toast.success("Deleted");
    fetchBanners();
  };

  const toggleActive = async (banner: HeroBanner) => {
    await supabase.from("hero_banners").update({ is_active: !banner.is_active }).eq("id", banner.id);
    fetchBanners();
  };

  if (adminLoading) return <AppLayout><div className="p-6 text-center text-muted-foreground">Loading...</div></AppLayout>;
  if (!isAdmin) return <AppLayout><div className="p-6 text-center text-muted-foreground">Admin access required.</div></AppLayout>;

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 lg:pt-6 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-serif font-bold text-foreground">Manage Hero Banners</h2>
          <Button onClick={() => { resetForm(); setShowForm(!showForm); }} className="gradient-gold text-primary-foreground gap-2">
            <Plus className="w-4 h-4" /> {showForm ? "Cancel" : "Add Banner"}
          </Button>
        </div>

        {showForm && (
          <div className="glass-card p-5 mb-6 space-y-4">
            <h3 className="font-serif font-bold text-foreground">{editing ? "Edit Banner" : "New Banner"}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
              <input placeholder="Subtitle" value={form.subtitle} onChange={e => setForm({ ...form, subtitle: e.target.value })}
                className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
              <textarea placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm md:col-span-2" rows={2} />
              <input placeholder="CTA Button Text (e.g. Listen Now)" value={form.cta_text} onChange={e => setForm({ ...form, cta_text: e.target.value })}
                className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
              <input placeholder="Link URL (optional)" value={form.link_url} onChange={e => setForm({ ...form, link_url: e.target.value })}
                className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
              <input placeholder="Sort order" type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: Number(e.target.value) })}
                className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
            </div>

            <ImageUploadPicker bucket="hero-banners" label="Banner Image" value={form.image_url} onChange={url => setForm({ ...form, image_url: url })} />

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} /> Active
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={form.show_cta} onChange={e => setForm({ ...form, show_cta: e.target.checked })} /> Show CTA Button
              </label>
            </div>
            <Button onClick={handleSave} className="gradient-gold text-primary-foreground gap-2">
              <Save className="w-4 h-4" /> {editing ? "Update" : "Create"}
            </Button>
          </div>
        )}

        {loading ? (
          <p className="text-muted-foreground text-sm">Loading...</p>
        ) : banners.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">No banners yet. Add one to show on the homepage.</p>
        ) : (
          <div className="space-y-2">
            {banners.map(banner => (
              <div key={banner.id} className="glass-card p-4 flex items-center gap-4">
                <div className="w-20 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-muted flex items-center justify-center">
                  {banner.image_url ? (
                    <img src={banner.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{banner.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{banner.subtitle || "No subtitle"}</p>
                  <div className="flex gap-2 mt-1">
                    {banner.is_active ? (
                      <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">Active</span>
                    ) : (
                      <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Inactive</span>
                    )}
                    {banner.show_cta && banner.cta_text && (
                      <span className="text-[10px] bg-gold/20 text-gold px-1.5 py-0.5 rounded">CTA: {banner.cta_text}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => toggleActive(banner)}
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                    {banner.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button onClick={() => handleEdit(banner)}
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-gold transition-colors">
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(banner.id)}
                    className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
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

export default AdminBanners;
