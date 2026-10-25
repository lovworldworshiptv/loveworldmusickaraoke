import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { toast } from "sonner";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import SettingSongPicker from "@/components/admin/SettingSongPicker";
import { cardGradient, GLOBAL_PLAYLISTS_CARD, getSetting, saveSetting, SETTING_KEYS } from "@/lib/siteSettings";
import { HOME_SECTION_DEFAULTS, type HomeSectionContent, type HomeSectionText } from "@/lib/homeSections";

type Pl = { id: string; name: string };
type Cat = { id: string; name: string; image_url: string | null; is_visible: boolean; sort_order: number };

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="glass-card rounded-2xl p-4 mb-5 space-y-4">
    <h2 className="text-lg font-serif font-bold text-foreground">{title}</h2>
    {children}
  </section>
);

/** Small heading + title for one home section. */
const TextEditor = ({ id, value, onSave, withColor }: { id: string; value: HomeSectionText; onSave: (v: HomeSectionText) => void; withColor?: boolean }) => {
  const def = HOME_SECTION_DEFAULTS[id];
  const [v, setV] = useState<HomeSectionText>(value);
  useEffect(() => setV(value), [value]);
  const color = v.cardColor || GLOBAL_PLAYLISTS_CARD;
  return (
    <div className="space-y-2">
      <div className="grid sm:grid-cols-2 gap-2">
        <label className="text-xs text-foreground space-y-1"><span>Small heading (leave empty to hide)</span>
          <Input value={v.eyebrow ?? def.eyebrow} maxLength={40} onChange={(e) => setV({ ...v, eyebrow: e.target.value })} />
        </label>
        <label className="text-xs text-foreground space-y-1"><span>Title</span>
          <Input value={v.title ?? ""} maxLength={50} placeholder={def.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
        </label>
      </div>
      {withColor && (
        <div className="flex items-center gap-3">
          <input type="color" value={color} onChange={(e) => setV({ ...v, cardColor: e.target.value })} className="w-10 h-10 rounded-lg bg-transparent border-0" aria-label="Card colour" />
          <div className="flex-1 h-10 rounded-xl" style={{ background: cardGradient(color) }} />
          <Button variant="outline" size="sm" onClick={() => setV({ ...v, cardColor: undefined })}>Default colour</Button>
        </div>
      )}
      <Button size="sm" onClick={() => onSave(v)}>Save wording</Button>
    </div>
  );
};

/** Ordered pick of homepage playlists saved to one app setting. */
const PlaylistPicker = ({ settingKey, options }: { settingKey: string; options: Pl[] }) => {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => { getSetting<string[]>(settingKey).then((v) => setIds(v || [])); }, [settingKey]);
  const persist = async (next: string[]) => {
    setIds(next);
    const { error } = await saveSetting(settingKey, next);
    error ? toast.error("Could not save") : toast.success("Saved");
  };
  const name = (id: string) => options.find((o) => o.id === id)?.name;
  const chosen = ids.filter((id) => name(id));
  const swap = (i: number, j: number) => { const n = [...chosen]; [n[i], n[j]] = [n[j], n[i]]; persist(n); };
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-foreground">Playlists shown ({chosen.length})</p>
      <p className="text-xs text-muted-foreground">Leave empty to show the newest playlists automatically. Only playlists switched on for the home page in <Link to="/admin/playlists" className="underline">Manage Playlists</Link> can be picked.</p>
      <ol className="space-y-1">
        {chosen.map((id, i) => (
          <li key={id} className="flex items-center gap-2 text-sm bg-muted/50 rounded-lg px-3 py-2 text-foreground">
            <span className="flex-1 truncate">{i + 1}. {name(id)}</span>
            <button aria-label="Move up" disabled={i === 0} onClick={() => swap(i, i - 1)}><ArrowUp className="w-4 h-4" /></button>
            <button aria-label="Move down" disabled={i === chosen.length - 1} onClick={() => swap(i, i + 1)}><ArrowDown className="w-4 h-4" /></button>
            <button className="text-destructive text-xs" onClick={() => persist(chosen.filter((x) => x !== id))}>Remove</button>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        {options.filter((o) => !chosen.includes(o.id)).map((o) => (
          <button key={o.id} onClick={() => persist([...chosen, o.id])} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/70 text-foreground">
            <Plus className="w-3 h-3 text-gold" /> {o.name}
          </button>
        ))}
      </div>
    </div>
  );
};

const AdminHomeSections = () => {
  const { isAdmin, loading } = useIsAdmin();
  const navigate = useNavigate();
  const [content, setContent] = useState<HomeSectionContent>({});
  const [playlists, setPlaylists] = useState<Pl[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);

  useEffect(() => { if (!loading && !isAdmin) navigate("/"); }, [isAdmin, loading, navigate]);

  const loadCats = () => supabase.from("categories").select("id,name,image_url,is_visible,sort_order").order("sort_order").then(({ data }) => setCats((data as Cat[]) || []));
  useEffect(() => {
    if (!isAdmin) return;
    getSetting<HomeSectionContent>(SETTING_KEYS.homeSectionContent).then((v) => setContent(v || {}));
    supabase.from("playlists").select("id,name").eq("is_visible_on_homepage", true).order("created_at", { ascending: false })
      .then(({ data }) => setPlaylists((data as Pl[]) || []));
    loadCats();
  }, [isAdmin]);

  const saveText = async (id: string, v: HomeSectionText) => {
    const next = { ...content, [id]: v };
    const { error } = await saveSetting(SETTING_KEYS.homeSectionContent, next);
    if (error) return toast.error("Could not save");
    setContent(next); toast.success("Wording saved");
  };

  const moveCat = async (i: number, d: number) => {
    const j = i + d; if (j < 0 || j >= cats.length) return;
    const n = [...cats]; [n[i], n[j]] = [n[j], n[i]];
    setCats(n);
    const results = await Promise.all(n.map((c, k) => supabase.from("categories").update({ sort_order: k }).eq("id", c.id)));
    results.some((r) => r.error) ? toast.error("Could not save order") : toast.success("Order saved");
    loadCats();
  };

  const toggleCat = async (c: Cat, visible: boolean) => {
    setCats((list) => list.map((x) => (x.id === c.id ? { ...x, is_visible: visible } : x)));
    const { error } = await supabase.from("categories").update({ is_visible: visible }).eq("id", c.id);
    error ? toast.error("Could not save") : toast.success(visible ? "Shown on home page" : "Hidden from home page");
  };

  if (loading || !isAdmin) return null;

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 py-6 max-w-3xl mx-auto pb-28">
        <h1 className="text-2xl font-serif font-bold text-foreground mb-1">Home Sections</h1>
        <p className="text-sm text-muted-foreground mb-5">Choose what appears in each home page section and how it's named. Show, hide or reorder whole sections in <Link to="/admin/appearance" className="underline">Appearance & Home</Link>.</p>

        <Card title="Quick Picks">
          <TextEditor id="quick_picks" value={content.quick_picks || {}} onSave={(v) => saveText("quick_picks", v)} />
          <SettingSongPicker settingKey={SETTING_KEYS.curatedQuickPicks} label="Songs"
            hint="Leave empty to mix each listener's recent plays with trending and featured songs. When a listener taps a mood, Quick Picks shows that mood's songs instead." />
        </Card>

        <Card title="Recommended Playlists">
          <TextEditor id="recommendations" value={content.recommendations || {}} onSave={(v) => saveText("recommendations", v)} />
          <PlaylistPicker settingKey={SETTING_KEYS.recommendedPlaylists} options={playlists} />
        </Card>

        <Card title="Soundtrack For Your Day">
          <TextEditor id="karaoke" value={content.karaoke || {}} onSave={(v) => saveText("karaoke", v)} />
          <SettingSongPicker settingKey={SETTING_KEYS.curatedKaraoke} label="Songs" hint="Leave empty to pick popular karaoke songs automatically (refreshed daily)." />
        </Card>

        <Card title="Categories">
          <TextEditor id="categories" value={content.categories || {}} onSave={(v) => saveText("categories", v)} />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Order and visibility</p>
            <p className="text-xs text-muted-foreground">Change names and pictures, or add new categories, in <Link to="/admin/categories" className="underline">Manage Categories</Link>.</p>
            {cats.map((c, i) => (
              <div key={c.id} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2 text-sm text-foreground">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-muted flex-shrink-0">{c.image_url && <img src={c.image_url} alt="" className="w-full h-full object-cover" />}</div>
                <span className="flex-1 truncate">{c.name}</span>
                <button aria-label={`Move ${c.name} up`} disabled={i === 0} onClick={() => moveCat(i, -1)}><ArrowUp className="w-4 h-4" /></button>
                <button aria-label={`Move ${c.name} down`} disabled={i === cats.length - 1} onClick={() => moveCat(i, 1)}><ArrowDown className="w-4 h-4" /></button>
                <Switch aria-label={`Show ${c.name}`} checked={c.is_visible} onCheckedChange={(v) => toggleCat(c, v)} />
              </div>
            ))}
          </div>
        </Card>

        <Card title="Global Playlists">
          <TextEditor id="global_playlists" value={content.global_playlists || {}} onSave={(v) => saveText("global_playlists", v)} withColor />
          <PlaylistPicker settingKey={SETTING_KEYS.globalPlaylists} options={playlists} />
        </Card>
      </div>
    </AppLayout>
  );
};

export default AdminHomeSections;
