import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Plus, Trash2, Edit3, Save, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import ImageUploadPicker from "@/components/admin/ImageUploadPicker";

interface Screen {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
}

const AdminOnboarding = () => {
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [screens, setScreens] = useState<Screen[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Screen | null>(null);
  const [form, setForm] = useState({ title: "", subtitle: "", description: "", image_url: "", sort_order: 0, is_active: true });

  useEffect(() => { fetchScreens(); }, []);

  const fetchScreens = async () => {
    const { data } = await supabase.from("onboarding_screens").select("*").order("sort_order");
    if (data) setScreens(data);
    setLoading(false);
  };

  const resetForm = () => {
    setForm({ title: "", subtitle: "", description: "", image_url: "", sort_order: 0, is_active: true });
    setEditing(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    const payload = {
      title: form.title,
      subtitle: form.subtitle || null,
      description: form.description || null,
      image_url: form.image_url || null,
      sort_order: form.sort_order,
      is_active: form.is_active,
    };
    if (editing) {
      const { error } = await supabase.from("onboarding_screens").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Screen updated!");
    } else {
      const { error } = await supabase.from("onboarding_screens").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Screen created!");
    }
    resetForm();
    fetchScreens();
  };

  const handleEdit = (s: Screen) => {
    setForm({
      title: s.title, subtitle: s.subtitle || "", description: s.description || "",
      image_url: s.image_url || "", sort_order: s.sort_order, is_active: s.is_active,
    });
    setEditing(s);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this screen?")) return;
    await supabase.from("onboarding_screens").delete().eq("id", id);
    toast.success("Deleted");
    fetchScreens();
  };

  const toggleActive = async (s: Screen) => {
    await supabase.from("onboarding_screens").update({ is_active: !s.is_active }).eq("id", s.id);
    fetchScreens();
  };

  if (adminLoading) return <AppLayout><div className="p-6 text-center text-muted-foreground">Loading...</div></AppLayout>;
  if (!isAdmin) return <AppLayout><div className="p-6 text-center text-muted-foreground">Admin access required.</div></AppLayout>;

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 lg:pt-6 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-serif font-bold text-foreground">Onboarding Screens</h2>
          <Button onClick={() => { resetForm(); setShowForm(!showForm); }} className="gradient-gold text-primary-foreground gap-2">
            <Plus className="w-4 h-4" /> {showForm ? "Cancel" : "Add Screen"}
          </Button>
        </div>

        {showForm && (
          <div className="glass-card p-5 mb-6 space-y-4">
            <h3 className="font-serif font-bold text-foreground">{editing ? "Edit Screen" : "New Screen"}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
              <input placeholder="Subtitle" value={form.subtitle} onChange={e => setForm({ ...form, subtitle: e.target.value })}
                className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
            </div>
            <textarea placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              className="w-full min-h-[80px] px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm resize-y" />
            <ImageUploadPicker bucket="onboarding-images" label="Background Image" value={form.image_url} onChange={url => setForm({ ...form, image_url: url })} />
            <div className="flex gap-4">
              <input placeholder="Sort order" type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: Number(e.target.value) })}
                className="w-24 px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} /> Active
              </label>
            </div>
            <Button onClick={handleSave} className="gradient-gold text-primary-foreground gap-2">
              <Save className="w-4 h-4" /> {editing ? "Update" : "Create"}
            </Button>
          </div>
        )}

        {loading ? (
          <p className="text-muted-foreground text-sm">Loading...</p>
        ) : screens.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">No onboarding screens yet.</p>
        ) : (
          <div className="space-y-2">
            {screens.map(s => (
              <div key={s.id} className="glass-card p-4 flex items-center gap-4">
                <div className="w-16 h-24 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                  {s.image_url ? (
                    <img src={s.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full gradient-purple flex items-center justify-center">
                      <span className="text-lg font-serif text-gold">{s.sort_order + 1}</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{s.title}</p>
                  {s.subtitle && <p className="text-xs text-gold truncate">{s.subtitle}</p>}
                  {s.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{s.description}</p>}
                  <p className="text-[10px] text-muted-foreground mt-1">Order: {s.sort_order} {!s.is_active && "• Inactive"}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => toggleActive(s)}
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                    {s.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button onClick={() => handleEdit(s)}
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-gold transition-colors">
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(s.id)}
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

export default AdminOnboarding;
