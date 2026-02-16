import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Plus, Trash2, Edit3, Save, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Category {
  id: string;
  name: string;
  image_url: string | null;
  is_visible: boolean;
  sort_order: number;
}

const AdminCategories = () => {
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: "", image_url: "", sort_order: 0, is_visible: true });

  useEffect(() => { fetchCategories(); }, []);

  const fetchCategories = async () => {
    const { data } = await supabase.from("categories").select("*").order("sort_order");
    if (data) setCategories(data);
    setLoading(false);
  };

  const resetForm = () => {
    setForm({ name: "", image_url: "", sort_order: 0, is_visible: true });
    setEditingCat(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    const payload = {
      name: form.name, image_url: form.image_url || null,
      sort_order: form.sort_order, is_visible: form.is_visible,
    };
    if (editingCat) {
      const { error } = await supabase.from("categories").update(payload).eq("id", editingCat.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Category updated!");
    } else {
      const { error } = await supabase.from("categories").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Category created!");
    }
    resetForm();
    fetchCategories();
  };

  const handleEdit = (cat: Category) => {
    setForm({ name: cat.name, image_url: cat.image_url || "", sort_order: cat.sort_order, is_visible: cat.is_visible });
    setEditingCat(cat);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this category?")) return;
    await supabase.from("categories").delete().eq("id", id);
    toast.success("Deleted");
    fetchCategories();
  };

  const toggleVisibility = async (cat: Category) => {
    await supabase.from("categories").update({ is_visible: !cat.is_visible }).eq("id", cat.id);
    fetchCategories();
  };

  if (adminLoading) return <AppLayout><div className="p-6 text-center text-muted-foreground">Loading...</div></AppLayout>;
  if (!isAdmin) return <AppLayout><div className="p-6 text-center text-muted-foreground">Admin access required.</div></AppLayout>;

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 lg:pt-6 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-serif font-bold text-foreground">Manage Categories</h2>
          <Button onClick={() => { resetForm(); setShowForm(!showForm); }} className="gradient-gold text-primary-foreground gap-2">
            <Plus className="w-4 h-4" /> {showForm ? "Cancel" : "Add Category"}
          </Button>
        </div>

        {showForm && (
          <div className="glass-card p-5 mb-6 space-y-4">
            <h3 className="font-serif font-bold text-foreground">{editingCat ? "Edit Category" : "New Category"}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
              <input placeholder="Image URL" value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })}
                className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
              <input placeholder="Sort order" type="number" value={form.sort_order} onChange={e => setForm({ ...form, sort_order: Number(e.target.value) })}
                className="px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
            </div>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={form.is_visible} onChange={e => setForm({ ...form, is_visible: e.target.checked })} /> Visible
            </label>
            <Button onClick={handleSave} className="gradient-gold text-primary-foreground gap-2">
              <Save className="w-4 h-4" /> {editingCat ? "Update" : "Create"}
            </Button>
          </div>
        )}

        {loading ? (
          <p className="text-muted-foreground text-sm">Loading...</p>
        ) : categories.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">No categories yet.</p>
        ) : (
          <div className="space-y-2">
            {categories.map(cat => (
              <div key={cat.id} className="glass-card p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full gradient-purple flex-shrink-0 overflow-hidden flex items-center justify-center">
                  {cat.image_url ? (
                    <img src={cat.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-lg font-serif text-gold">{cat.name[0]}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{cat.name}</p>
                  <p className="text-xs text-muted-foreground">Order: {cat.sort_order} {!cat.is_visible && "• Hidden"}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => toggleVisibility(cat)}
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                    {cat.is_visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button onClick={() => handleEdit(cat)}
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-gold transition-colors">
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(cat.id)}
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

export default AdminCategories;
