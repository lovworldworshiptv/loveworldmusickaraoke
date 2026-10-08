import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Plus, Trash2, Edit3, Save, Eye, EyeOff, ArrowUp, ArrowDown, Wand2, X, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import fallback1 from "@/assets/onboarding-1.jpg";
import fallback2 from "@/assets/onboarding-2.jpg";
import fallback3 from "@/assets/onboarding-3.jpg";

const fallbacks = [fallback1, fallback2, fallback3];
const PRESETS = [
  { badge: "Song · Karaoke · Video", title: "Worship your way", subtitle: "Three modes, one player", description: "Stream songs, sing along with synced karaoke lyrics, or switch to video, all without missing a beat." },
  { badge: "Stage Mode · Languages", title: "Lead worship anywhere", subtitle: "Big lyrics for every stage", description: "Full-screen Stage Mode for rehearsals and services, with lyrics in your preferred language." },
  { badge: "Discover · Articles · Games", title: "Grow every day", subtitle: "Daily Discover, Bible & quizzes", description: "Fresh daily picks, inspiring articles with scripture, and fun music quizzes and challenges." },
  { badge: "Community · Referrals", title: "Worship together", subtitle: "Communities, stories & rewards", description: "Join communities, share karaoke stories, and earn 10% when friends you invite go premium." },
];
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import OnboardingInsights from "@/components/admin/OnboardingInsights";
import ImageUploadPicker from "@/components/admin/ImageUploadPicker";

interface Screen {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  badge: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
}

const inputCls = "w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-gold/50";
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block space-y-1"><span className="text-xs font-medium text-muted-foreground">{label}</span>{children}</label>
);
const emptyForm = { title: "", subtitle: "", description: "", badge: "", image_url: "", sort_order: 0, is_active: true };

const AdminOnboarding = () => {
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [screens, setScreens] = useState<Screen[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Screen | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"screens" | "insights">("screens");
  const [filter, setFilter] = useState<"all" | "active" | "hidden">("all");

  useEffect(() => { if (isAdmin) fetchScreens(); }, [isAdmin]);

  const fetchScreens = async () => {
    const { data, error } = await supabase.from("onboarding_screens").select("*").order("sort_order").order("created_at");
    if (error) toast.error("Could not load screens");
    if (data) setScreens(data as Screen[]);
    setLoading(false);
  };

  const scrollToEditor = () => setTimeout(() => document.getElementById("onboarding-editor")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);

  const closeForm = () => { setForm(emptyForm); setEditing(null); setShowForm(false); };

  const openNew = () => {
    setTab("screens");
    setEditing(null);
    setForm({ ...emptyForm, sort_order: screens.length });
    setShowForm(true);
    scrollToEditor();
  };

  const handleEdit = (s: Screen) => {
    setTab("screens");
    setForm({ title: s.title, subtitle: s.subtitle || "", description: s.description || "", badge: s.badge || "",
      image_url: s.image_url || "", sort_order: s.sort_order, is_active: s.is_active });
    setEditing(s);
    setShowForm(true);
    scrollToEditor();
  };

  const handleSave = async () => {
    const title = form.title.trim();
    if (!title) { toast.error("Please add a title"); return; }
    setSaving(true);
    const payload = {
      title, subtitle: form.subtitle.trim() || null, description: form.description.trim() || null,
      badge: form.badge.trim() || null, image_url: form.image_url || null,
      sort_order: Number.isFinite(form.sort_order) ? form.sort_order : screens.length, is_active: form.is_active,
    };
    const { error } = editing
      ? await supabase.from("onboarding_screens").update(payload).eq("id", editing.id)
      : await supabase.from("onboarding_screens").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Screen updated" : "Screen created");
    closeForm();
    fetchScreens();
  };

  const handleDelete = async (s: Screen) => {
    if (!confirm(`Delete "${s.title}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("onboarding_screens").delete().eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    if (editing?.id === s.id) closeForm();
    setScreens((prev) => prev.filter((x) => x.id !== s.id));
    toast.success("Screen deleted");
  };

  const move = async (id: string, dir: -1 | 1) => {
    const i = screens.findIndex((x) => x.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= screens.length || busy) return;
    const ordered = [...screens];
    [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
    const next = ordered.map((s, idx) => ({ ...s, sort_order: idx }));
    setScreens(next);
    setBusy(true);
    const results = await Promise.all(next.map((s) => supabase.from("onboarding_screens").update({ sort_order: s.sort_order }).eq("id", s.id)));
    setBusy(false);
    if (results.some((r) => r.error)) toast.error("Could not reorder");
    fetchScreens();
  };

  const toggleActive = async (s: Screen) => {
    setScreens((prev) => prev.map((x) => (x.id === s.id ? { ...x, is_active: !s.is_active } : x)));
    const { error } = await supabase.from("onboarding_screens").update({ is_active: !s.is_active }).eq("id", s.id);
    if (error) { toast.error(error.message); fetchScreens(); return; }
    toast.success(s.is_active ? "Screen hidden from new users" : "Screen is now visible");
  };

  const loadPresets = async () => {
    if (!confirm("Add the 4 recommended screens? Your current screens will be hidden, not deleted.")) return;
    setBusy(true);
    const ids = screens.map((s) => s.id);
    const hide = ids.length ? await supabase.from("onboarding_screens").update({ is_active: false }).in("id", ids) : { error: null };
    const ins = await supabase.from("onboarding_screens").insert(PRESETS.map((p, i) => ({ ...p, sort_order: i, is_active: true })));
    setBusy(false);
    if (hide.error || ins.error) toast.error((hide.error || ins.error)!.message);
    else {
      // push hidden ones after the new screens so the order stays clean
      await Promise.all(screens.map((s, k) => supabase.from("onboarding_screens").update({ sort_order: PRESETS.length + k }).eq("id", s.id)));
      toast.success("Recommended screens added");
    }
    fetchScreens();
  };

  if (adminLoading) return <AppLayout><div className="p-6 text-center text-muted-foreground">Loading...</div></AppLayout>;
  if (!isAdmin) return <AppLayout><div className="p-6 text-center text-muted-foreground">Admin access required.</div></AppLayout>;

  const activeCount = screens.filter((s) => s.is_active).length;
  const hiddenCount = screens.length - activeCount;
  const visible = screens.filter((s) => filter === "all" || (filter === "active" ? s.is_active : !s.is_active));
  const activeScreens = screens.filter((s) => s.is_active);
  const previewIndex = Math.max(0, form.sort_order);

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 lg:pt-6 max-w-4xl">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h2 className="text-2xl font-serif font-bold text-foreground">Onboarding Screens</h2>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={loadPresets} disabled={busy} className="gap-2"><Wand2 className="w-4 h-4" /> Recommended screens</Button>
            <Button onClick={() => (showForm && !editing ? closeForm() : openNew())} className="gradient-gold text-primary-foreground gap-2">
              {showForm && !editing ? <><X className="w-4 h-4" /> Cancel</> : <><Plus className="w-4 h-4" /> Add Screen</>}
            </Button>
          </div>
        </div>

        <div role="tablist" className="flex gap-1 p-1 mb-5 rounded-xl bg-muted w-fit">
          {([["screens", `Screens (${activeCount}/${screens.length})`], ["insights", "Insights"]] as const).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === id ? "gradient-gold text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{label}</button>
          ))}
        </div>

        {tab === "insights" ? (
          <OnboardingInsights titles={activeScreens.map((x) => x.title)} />
        ) : (
          <>
            {showForm && (
              <div id="onboarding-editor" className="glass-card p-5 mb-6 grid gap-5 md:grid-cols-[1fr_220px] scroll-mt-20 border border-gold/40">
                <div className="space-y-3">
                  <h3 className="font-serif font-bold text-foreground">{editing ? `Editing: ${editing.title}` : "New onboarding screen"}</h3>
                  <Field label="Headline *"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Worship your way" className={inputCls} /></Field>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Subtitle"><input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} placeholder="Short gold line above the headline" className={inputCls} /></Field>
                    <Field label="Badge"><input value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })} placeholder="e.g. Song · Karaoke · Video" className={inputCls} /></Field>
                  </div>
                  <Field label="Description"><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="One or two sentences" className={`${inputCls} min-h-[80px] resize-y`} /></Field>
                  <ImageUploadPicker bucket="onboarding-images" label="Background image" value={form.image_url} onChange={(url) => setForm({ ...form, image_url: url })} />
                  <div className="flex items-end gap-4 flex-wrap">
                    <Field label="Position"><input type="number" min={0} value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} className={`${inputCls} w-24`} /></Field>
                    <label className="flex items-center gap-2 text-sm text-foreground pb-2">
                      <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /> {form.is_active ? "Visible to new users" : "Hidden"}
                    </label>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button onClick={handleSave} disabled={saving} className="gradient-gold text-primary-foreground gap-2">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {editing ? "Save changes" : "Create screen"}
                    </Button>
                    <Button variant="outline" onClick={closeForm} disabled={saving}>Cancel</Button>
                  </div>
                </div>
                <div aria-label="Live preview" className="relative mx-auto w-[200px] h-[400px] rounded-[28px] overflow-hidden border-4 border-border bg-background">
                  <img src={form.image_url || fallbacks[previewIndex % 3]} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
                  <div className="absolute bottom-5 left-3 right-3">
                    {form.badge && <span className="inline-block mb-2 px-2 py-0.5 rounded-full border border-gold/40 text-gold text-[8px] font-semibold tracking-widest uppercase">{form.badge}</span>}
                    {form.subtitle && <p className="text-gold text-[9px] uppercase tracking-wider mb-1">{form.subtitle}</p>}
                    <p className="font-serif font-bold text-foreground text-base leading-tight mb-1">{form.title || "Screen title"}</p>
                    {form.description && <p className="text-muted-foreground text-[10px] leading-snug line-clamp-4">{form.description}</p>}
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 mb-3 flex-wrap">
              {([["all", "All", screens.length], ["active", "Visible", activeCount], ["hidden", "Hidden", hiddenCount]] as const).map(([id, label, n]) => (
                <button key={id} onClick={() => setFilter(id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filter === id ? "gradient-gold text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>{label} ({n})</button>
              ))}
            </div>

            {loading ? (
              <p className="text-muted-foreground text-sm">Loading...</p>
            ) : visible.length === 0 ? (
              <p className="text-muted-foreground text-center py-12">{screens.length === 0 ? "No onboarding screens yet." : "No screens in this view."}</p>
            ) : (
              <div className="space-y-2">
                {visible.map((s) => {
                  const i = screens.findIndex((x) => x.id === s.id);
                  const step = s.is_active ? activeScreens.findIndex((x) => x.id === s.id) + 1 : null;
                  return (
                    <div key={s.id} className={`glass-card p-4 flex items-center gap-4 ${editing?.id === s.id ? "ring-2 ring-gold" : ""} ${!s.is_active ? "opacity-70" : ""}`}>
                      <div className="w-16 h-24 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                        <img src={s.image_url || fallbacks[i % 3]} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.is_active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                            {s.is_active ? `Visible · step ${step}` : "Hidden"}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-foreground truncate">{s.title}</p>
                        {s.badge && <p className="text-[10px] uppercase tracking-wider text-gold/80 truncate">{s.badge}</p>}
                        {s.subtitle && <p className="text-xs text-gold truncate">{s.subtitle}</p>}
                        {s.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{s.description}</p>}
                      </div>
                      <div className="grid grid-cols-2 sm:flex gap-1">
                        <button aria-label="Move up" title="Move up" disabled={i === 0 || busy} onClick={() => move(s.id, -1)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowUp className="w-4 h-4" /></button>
                        <button aria-label="Move down" title="Move down" disabled={i === screens.length - 1 || busy} onClick={() => move(s.id, 1)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30"><ArrowDown className="w-4 h-4" /></button>
                        <button aria-label={s.is_active ? "Hide screen" : "Show screen"} title={s.is_active ? "Hide" : "Show"} onClick={() => toggleActive(s)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground">
                          {s.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                        <button aria-label="Edit screen" title="Edit" onClick={() => handleEdit(s)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-gold"><Edit3 className="w-4 h-4" /></button>
                        <button aria-label="Delete screen" title="Delete" onClick={() => handleDelete(s)} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
      <div className="h-8" />
    </AppLayout>
  );
};

export default AdminOnboarding;
