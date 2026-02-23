import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Sparkles, Plus, Trash2, Edit3, X, Save, Search, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import ImageUploadPicker from "@/components/admin/ImageUploadPicker";
import { toast } from "sonner";

interface PremiumAd {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  image_url: string | null;
  cta_text: string | null;
  link_url: string | null;
  placement: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

const PLACEMENTS = [
  { value: "secondary_banner", label: "Home Secondary Banner" },
  { value: "library_banner", label: "Library Banner" },
  { value: "player_banner", label: "Player Banner" },
];

const AdminPremiumAds = () => {
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [ads, setAds] = useState<PremiumAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PremiumAd | null>(null);

  const [form, setForm] = useState({
    title: "", subtitle: "", description: "", image_url: "",
    cta_text: "Get Premium", link_url: "", placement: "secondary_banner",
    is_active: true, sort_order: 0,
  });

  useEffect(() => { fetchAds(); }, []);

  const fetchAds = async () => {
    const { data } = await supabase.from("premium_ads").select("*").order("sort_order").order("created_at", { ascending: false });
    setAds((data as PremiumAd[]) || []);
    setLoading(false);
  };

  const resetForm = () => {
    setForm({ title: "", subtitle: "", description: "", image_url: "", cta_text: "Get Premium", link_url: "", placement: "secondary_banner", is_active: true, sort_order: 0 });
    setEditing(null);
    setShowForm(false);
  };

  const openEdit = (ad: PremiumAd) => {
    setEditing(ad);
    setForm({
      title: ad.title, subtitle: ad.subtitle || "", description: ad.description || "",
      image_url: ad.image_url || "", cta_text: ad.cta_text || "Get Premium",
      link_url: ad.link_url || "", placement: ad.placement,
      is_active: ad.is_active, sort_order: ad.sort_order,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    const payload = {
      title: form.title.trim(),
      subtitle: form.subtitle.trim() || null,
      description: form.description.trim() || null,
      image_url: form.image_url.trim() || null,
      cta_text: form.cta_text.trim() || "Get Premium",
      link_url: form.link_url.trim() || null,
      placement: form.placement,
      is_active: form.is_active,
      sort_order: form.sort_order,
    };

    if (editing) {
      const { error } = await supabase.from("premium_ads").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success("Premium ad updated!");
    } else {
      const { error } = await supabase.from("premium_ads").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Premium ad created!");
    }
    resetForm();
    fetchAds();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this premium ad?")) return;
    await supabase.from("premium_ads").delete().eq("id", id);
    toast.success("Deleted");
    fetchAds();
  };

  const toggleActive = async (ad: PremiumAd) => {
    await supabase.from("premium_ads").update({ is_active: !ad.is_active }).eq("id", ad.id);
    fetchAds();
  };

  const filtered = ads.filter(a => a.title.toLowerCase().includes(search.toLowerCase()));

  if (adminLoading) return <AppLayout><div className="p-6 text-center text-muted-foreground">Loading...</div></AppLayout>;
  if (!isAdmin) return <AppLayout><div className="p-6 text-center text-muted-foreground">Admin access required.</div></AppLayout>;

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 lg:pt-6 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-serif font-bold text-foreground">Premium Ads</h2>
          <Button onClick={() => { resetForm(); setShowForm(true); }} className="gradient-gold text-primary-foreground gap-2">
            <Plus className="w-4 h-4" /> New Ad
          </Button>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Search ads..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
        </div>

        {showForm && (
          <div className="glass-card p-5 mb-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif font-bold text-foreground">{editing ? "Edit" : "New"} Premium Ad</h3>
              <button onClick={resetForm} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <Input placeholder="Title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            <Input placeholder="Subtitle" value={form.subtitle} onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))} />
            <Textarea placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            <ImageUploadPicker bucket="hero-banners" value={form.image_url} onChange={url => setForm(f => ({ ...f, image_url: url }))} label="Ad Image" />
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="CTA Text" value={form.cta_text} onChange={e => setForm(f => ({ ...f, cta_text: e.target.value }))} />
              <Input placeholder="Link URL" value={form.link_url} onChange={e => setForm(f => ({ ...f, link_url: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select value={form.placement} onValueChange={v => setForm(f => ({ ...f, placement: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLACEMENTS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input type="number" placeholder="Sort order" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
              <span className="text-sm text-foreground">Active</span>
            </div>
            <Button onClick={handleSave} className="gradient-gold text-primary-foreground gap-1 w-full">
              <Save className="w-4 h-4" /> {editing ? "Update" : "Create"}
            </Button>
          </div>
        )}

        {loading ? (
          <p className="text-muted-foreground text-sm">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">No premium ads found.</p>
        ) : (
          <div className="space-y-2">
            {filtered.map(ad => (
              <div key={ad.id} className="glass-card p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                  {ad.image_url ? (
                    <img src={ad.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full gradient-purple flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-gold/40" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{ad.title}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{PLACEMENTS.find(p => p.value === ad.placement)?.label || ad.placement}</span>
                    <span>•</span>
                    <span className={ad.is_active ? "text-green-500" : "text-muted-foreground"}>{ad.is_active ? "Active" : "Inactive"}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => toggleActive(ad)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                    {ad.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button onClick={() => openEdit(ad)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-gold transition-colors">
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(ad.id)} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
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

export default AdminPremiumAds;
