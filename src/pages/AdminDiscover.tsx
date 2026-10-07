import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Save, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useIsEditor } from "@/hooks/useIsEditor";
import ImageUploadPicker from "@/components/admin/ImageUploadPicker";
import CategoryTile from "@/components/discover/CategoryTile";
import { type DiscoverCategory, type DiscoverFeatured, contrastRatio } from "@/lib/discover";

const db = supabase as any;
const input = "w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground";
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block text-xs text-foreground space-y-1"><span>{label}</span>{children}</label>
);

/** Ordered song picker for a curated Featured playlist. */
const SongPicker = ({ ids, onChange }: { ids: string[]; onChange: (ids: string[]) => void }) => {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; title: string; artist: string }[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    const missing = ids.filter((i) => !names[i]);
    if (!missing.length) return;
    db.from("songs").select("id, title").in("id", missing).then(({ data }: any) =>
      setNames((n) => ({ ...n, ...Object.fromEntries((data || []).map((r: any) => [r.id, r.title])) })));
  }, [ids]);
  useEffect(() => {
    const t = q.replace(/[,()%]/g, " ").trim();
    if (t.length < 2) { setResults([]); return; }
    const h = setTimeout(async () => {
      const { data } = await db.from("songs").select("id, title, artist").or(`title.ilike.%${t}%,artist.ilike.%${t}%`).limit(8);
      setResults(data || []);
    }, 200);
    return () => clearTimeout(h);
  }, [q]);
  const mv = (i: number, d: number) => {
    const j = i + d; if (j < 0 || j >= ids.length) return;
    const n = [...ids]; [n[i], n[j]] = [n[j], n[i]]; onChange(n);
  };
  return (
    <div className="space-y-2">
      <p className="text-xs">Songs ({ids.length})</p>
      {ids.map((id, i) => (
        <div key={id} className="flex items-center gap-2 text-sm bg-muted/50 rounded-lg px-2 py-1.5">
          <span className="w-5 text-xs">{i + 1}</span>
          <span className="flex-1 truncate">{names[id] || "…"}</span>
          <button aria-label="Move up" onClick={() => mv(i, -1)}><ArrowUp className="w-4 h-4" /></button>
          <button aria-label="Move down" onClick={() => mv(i, 1)}><ArrowDown className="w-4 h-4" /></button>
          <button aria-label="Remove" onClick={() => onChange(ids.filter((x) => x !== id))}><Trash2 className="w-4 h-4 text-destructive" /></button>
        </div>
      ))}
      <input className={input} placeholder="Search songs to add…" value={q} onChange={(e) => setQ(e.target.value)} />
      {results.filter((r) => !ids.includes(r.id)).map((r) => (
        <button key={r.id} onClick={() => { setNames((n) => ({ ...n, [r.id]: r.title })); onChange([...ids, r.id]); }}
          className="w-full flex items-center gap-2 text-left text-sm px-2 py-1.5 rounded-lg hover:bg-muted">
          <Plus className="w-4 h-4 text-gold" /><span className="truncate">{r.title} · {r.artist}</span>
        </button>
      ))}
    </div>
  );
};

const AdminDiscover = () => {
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const { isEditor, loading: editorLoading } = useIsEditor();
  const loading = adminLoading || editorLoading;
  const canManage = isAdmin || isEditor;
  const [tabState, setTab] = useState<"categories" | "featured">("categories");
  // Editors manage only the curated Featured playlists.
  const tab = isAdmin ? tabState : "featured";
  const [cats, setCats] = useState<DiscoverCategory[]>([]);
  const [feat, setFeat] = useState<DiscoverFeatured[]>([]);
  const [editCat, setEditCat] = useState<DiscoverCategory | null>(null);
  const [editFeat, setEditFeat] = useState<DiscoverFeatured | null>(null);

  const load = async () => {
    const [c, f] = await Promise.all([
      db.from("discover_categories").select("*").order("sort_order"),
      db.from("discover_featured").select("*").order("sort_order"),
    ]);
    setCats(c.data || []);
    setFeat(f.data || []);
  };
  useEffect(() => { if (canManage) load(); }, [canManage]);

  if (loading) return null;
  if (!canManage) return <Navigate to="/" replace />;

  const move = async (table: string, list: { id: string }[], i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    await Promise.all(next.map((x, k) => db.from(table).update({ sort_order: k }).eq("id", x.id)));
    load();
  };

  const saveCat = async () => {
    if (!editCat) return;
    if (!editCat.title.trim() || !editCat.route.trim()) return toast.error("Title and link are required");
    const { id, ...rest } = editCat;
    const { data: u } = await supabase.auth.getUser();
    const payload = { ...rest, updated_by: u.user?.id };
    const { error } = id ? await db.from("discover_categories").update(payload).eq("id", id) : await db.from("discover_categories").insert({ ...payload, sort_order: cats.length });
    if (error) return toast.error(error.message);
    toast.success("Category saved");
    setEditCat(null);
    load();
  };

  const saveFeat = async () => {
    if (!editFeat) return;
    if (!editFeat.label.trim()) return toast.error("Label is required");
    const { id, ...rest } = editFeat;
    const payload = { ...rest, starts_at: rest.starts_at || null, ends_at: rest.ends_at || null };
    const { error } = id ? await db.from("discover_featured").update(payload).eq("id", id) : await db.from("discover_featured").insert({ ...payload, sort_order: feat.length });
    if (error) return toast.error(error.message);
    toast.success("Featured item saved");
    setEditFeat(null);
    load();
  };

  const remove = async (table: string, id: string) => {
    if (!window.confirm("Delete this item?")) return;
    await db.from(table).delete().eq("id", id);
    load();
  };

  const ratio = editCat ? Math.min(contrastRatio(editCat.text_color, editCat.gradient_from), contrastRatio(editCat.text_color, editCat.gradient_to)) : 0;

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 lg:pt-6 max-w-5xl mx-auto pb-28 text-foreground">
        <h1 className="text-2xl font-serif font-bold mb-4">Discover page</h1>
        <div className="flex gap-2 mb-5">
          {(isAdmin ? (["categories", "featured"] as const) : (["featured"] as const)).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-full text-sm capitalize ${tab === t ? "gradient-gold" : "bg-muted"}`}>{t}</button>
          ))}
        </div>

        {tab === "categories" && (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="space-y-2">
              <button onClick={() => setEditCat({ id: "", title: "", subtitle: "", route: "/", gradient_from: "#1d4ed8", gradient_via: null, gradient_to: "#0b1437", text_color: "#FFFFFF", image_url: null, image_alt: "", is_hero: false, is_visible: true, sort_order: 0 })}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-gold/50 text-sm"><Plus className="w-4 h-4" /> Add category</button>
              {cats.map((c, i) => (
                <div key={c.id} className={`glass-card p-3 flex items-center gap-3 ${editCat?.id === c.id ? "ring-2 ring-gold" : ""}`}>
                  <div className="w-8 h-8 rounded-lg flex-shrink-0" style={{ background: c.gradient_from }} />
                  <button onClick={() => setEditCat(c)} className="flex-1 text-left min-w-0">
                    <p className="text-sm font-semibold truncate">{c.title} {c.is_hero && <span className="text-[10px] text-gold">HERO</span>}</p>
                    <p className="text-xs truncate opacity-80">{c.route}</p>
                  </button>
                  {c.is_visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4 opacity-50" />}
                  <button aria-label="Move up" onClick={() => move("discover_categories", cats, i, -1)}><ArrowUp className="w-4 h-4" /></button>
                  <button aria-label="Move down" onClick={() => move("discover_categories", cats, i, 1)}><ArrowDown className="w-4 h-4" /></button>
                  <button aria-label="Delete" onClick={() => remove("discover_categories", c.id)}><Trash2 className="w-4 h-4 text-destructive" /></button>
                </div>
              ))}
            </div>

            {editCat && (
              <div className="glass-card p-4 space-y-3">
                <p className="text-xs uppercase tracking-wider text-gold">Live preview</p>
                <div className="max-w-xs"><CategoryTile c={editCat} preview /></div>
                <Field label="Title"><input className={input} maxLength={40} value={editCat.title} onChange={(e) => setEditCat({ ...editCat, title: e.target.value })} /></Field>
                <Field label="Subtitle"><input className={input} maxLength={80} value={editCat.subtitle || ""} onChange={(e) => setEditCat({ ...editCat, subtitle: e.target.value })} /></Field>
                <Field label="Opens page (e.g. /videos or /discover/tag/worship)"><input className={input} value={editCat.route} onChange={(e) => setEditCat({ ...editCat, route: e.target.value })} /></Field>
                <div className="grid grid-cols-4 gap-2">
                  {(["gradient_from", "gradient_via", "gradient_to", "text_color"] as const).map((k) => (
                    <Field key={k} label={{ gradient_from: "From", gradient_via: "Middle", gradient_to: "To", text_color: "Text" }[k]}>
                      <input type="color" className="w-full h-9 rounded bg-transparent" value={editCat[k] || "#000000"} onChange={(e) => setEditCat({ ...editCat, [k]: e.target.value })} />
                    </Field>
                  ))}
                </div>
                {editCat.gradient_via && <button className="text-xs underline" onClick={() => setEditCat({ ...editCat, gradient_via: null })}>Remove middle colour</button>}
                <p className={`text-xs flex items-center gap-1 ${ratio < 4.5 ? "text-destructive" : "text-foreground"}`}>
                  {ratio < 4.5 && <AlertTriangle className="w-3.5 h-3.5" />} Text contrast {ratio.toFixed(1)}:1 {ratio < 4.5 ? "— below 4.5:1, may be hard to read" : "— readable"}
                </p>
                <ImageUploadPicker bucket="song-covers" label="Artwork (leave empty for built-in image)" value={editCat.image_url || ""} onChange={(url) => setEditCat({ ...editCat, image_url: url || null })} />
                <Field label="Image description (for screen readers)"><input className={input} value={editCat.image_alt || ""} onChange={(e) => setEditCat({ ...editCat, image_alt: e.target.value })} /></Field>
                <div className="flex gap-4 text-sm">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={editCat.is_hero} onChange={(e) => setEditCat({ ...editCat, is_hero: e.target.checked })} /> Full-width hero</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={editCat.is_visible} onChange={(e) => setEditCat({ ...editCat, is_visible: e.target.checked })} /> Visible</label>
                </div>
                <div className="flex gap-2">
                  <button onClick={saveCat} className="flex items-center gap-1 px-4 py-2 rounded-lg gradient-gold text-sm"><Save className="w-4 h-4" /> Save</button>
                  <button onClick={() => setEditCat(null)} className="px-4 py-2 rounded-lg bg-muted text-sm">Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "featured" && (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="space-y-2">
              <button onClick={() => setEditFeat({ id: "", label: "#", media_type: "image", image_url: null, video_url: null, poster_url: null, href: null, is_active: true, starts_at: null, ends_at: null, sort_order: 0, song_ids: [], description: "" })}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-gold/50 text-sm"><Plus className="w-4 h-4" /> Add featured item</button>
              {feat.map((f, i) => (
                <div key={f.id} className={`glass-card p-3 flex items-center gap-3 ${editFeat?.id === f.id ? "ring-2 ring-gold" : ""}`}>
                  <button onClick={() => setEditFeat(f)} className="flex-1 text-left min-w-0">
                    <p className="text-sm font-semibold truncate">{f.label}</p>
                    <p className="text-xs opacity-80">{f.media_type}{f.ends_at ? ` · ends ${new Date(f.ends_at).toLocaleDateString()}` : ""}</p>
                  </button>
                  {f.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4 opacity-50" />}
                  <button aria-label="Move up" onClick={() => move("discover_featured", feat, i, -1)}><ArrowUp className="w-4 h-4" /></button>
                  <button aria-label="Move down" onClick={() => move("discover_featured", feat, i, 1)}><ArrowDown className="w-4 h-4" /></button>
                  <button aria-label="Delete" onClick={() => remove("discover_featured", f.id)}><Trash2 className="w-4 h-4 text-destructive" /></button>
                </div>
              ))}
            </div>
            {editFeat && (
              <div className="glass-card p-4 space-y-3">
                <Field label="Playlist title (e.g. #praise)"><input className={input} maxLength={30} value={editFeat.label} onChange={(e) => setEditFeat({ ...editFeat, label: e.target.value })} /></Field>
                <Field label="Description"><input className={input} maxLength={160} value={editFeat.description || ""} onChange={(e) => setEditFeat({ ...editFeat, description: e.target.value })} /></Field>
                <SongPicker ids={editFeat.song_ids || []} onChange={(song_ids) => setEditFeat({ ...editFeat, song_ids })} />
                <div className="flex gap-2">
                  {(["image", "video"] as const).map((m) => (
                    <button key={m} onClick={() => setEditFeat({ ...editFeat, media_type: m })} className={`px-3 py-1 rounded-full text-xs capitalize ${editFeat.media_type === m ? "gradient-gold" : "bg-muted"}`}>{m}</button>
                  ))}
                </div>
                {editFeat.media_type === "image" ? (
                  <ImageUploadPicker bucket="song-covers" label="Image (portrait works best)" value={editFeat.image_url || ""} onChange={(url) => setEditFeat({ ...editFeat, image_url: url || null })} />
                ) : (
                  <>
                    <Field label="Video link (short, muted loop)"><input className={input} value={editFeat.video_url || ""} onChange={(e) => setEditFeat({ ...editFeat, video_url: e.target.value || null })} /></Field>
                    <ImageUploadPicker bucket="song-covers" label="Poster image" value={editFeat.poster_url || ""} onChange={(url) => setEditFeat({ ...editFeat, poster_url: url || null })} />
                  </>
                )}
                <Field label="Opens (only used when no songs are picked)"><input className={input} value={editFeat.href || ""} onChange={(e) => setEditFeat({ ...editFeat, href: e.target.value || null })} /></Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Starts"><input type="datetime-local" className={input} value={editFeat.starts_at?.slice(0, 16) || ""} onChange={(e) => setEditFeat({ ...editFeat, starts_at: e.target.value ? new Date(e.target.value).toISOString() : null })} /></Field>
                  <Field label="Ends"><input type="datetime-local" className={input} value={editFeat.ends_at?.slice(0, 16) || ""} onChange={(e) => setEditFeat({ ...editFeat, ends_at: e.target.value ? new Date(e.target.value).toISOString() : null })} /></Field>
                </div>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editFeat.is_active} onChange={(e) => setEditFeat({ ...editFeat, is_active: e.target.checked })} /> Active</label>
                <div className="flex gap-2">
                  <button onClick={saveFeat} className="flex items-center gap-1 px-4 py-2 rounded-lg gradient-gold text-sm"><Save className="w-4 h-4" /> Save</button>
                  <button onClick={() => setEditFeat(null)} className="px-4 py-2 rounded-lg bg-muted text-sm">Cancel</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default AdminDiscover;
