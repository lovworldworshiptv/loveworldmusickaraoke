import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowDown, ArrowUp, Search } from "lucide-react";
import { toast } from "sonner";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  applyTheme, cardGradient, DEFAULT_GLOBAL_CARD, getSetting, HOME_SECTIONS, resolveHomeLayout, saveSetting, SETTING_KEYS,
  type HomeSectionSetting, type ThemeColors,
} from "@/lib/siteSettings";

const THEME_FIELDS: { key: keyof ThemeColors; label: string; def: string }[] = [
  { key: "gold", label: "Main accent (gold)", def: "#d4a72c" },
  { key: "background", label: "App background", def: "#090e16" },
  { key: "accent", label: "Secondary accent (blue)", def: "#24508f" },
  { key: "foreground", label: "Main text", def: "#f5f3ef" },
];

type Pl = { id: string; name: string; card_color: string | null };
type SongLite = { id: string; title: string; artist: string };

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="glass-card rounded-2xl p-4 mb-5">
    <h2 className="text-lg font-serif font-bold text-foreground mb-3">{title}</h2>
    {children}
  </section>
);

const SongPicker = ({ settingKey, label }: { settingKey: string; label: string }) => {
  const [ids, setIds] = useState<string[]>([]);
  const [chosen, setChosen] = useState<SongLite[]>([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SongLite[]>([]);

  useEffect(() => {
    getSetting<string[]>(settingKey).then(async (v) => {
      const list = v || [];
      setIds(list);
      if (list.length) {
        const { data } = await supabase.from("songs").select("id,title,artist").in("id", list);
        setChosen(list.map((id) => (data || []).find((s) => s.id === id)).filter(Boolean) as SongLite[]);
      }
    });
  }, [settingKey]);

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(() => {
      supabase.from("songs").select("id,title,artist").ilike("title", `%${q.trim()}%`).limit(8).then(({ data }) => setResults(data || []));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const persist = async (next: SongLite[]) => {
    setChosen(next); setIds(next.map((s) => s.id));
    const { error } = await saveSetting(settingKey, next.map((s) => s.id));
    error ? toast.error("Could not save") : toast.success("Saved");
  };

  return (
    <div className="mb-4">
      <p className="text-sm font-semibold text-foreground mb-1">{label}</p>
      <p className="text-xs text-muted-foreground mb-2">Leave empty to pick automatically from popular songs.</p>
      <div className="relative mb-2">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search songs to add" className="pl-9" />
      </div>
      {results.filter((r) => !ids.includes(r.id)).map((r) => (
        <button key={r.id} onClick={() => { persist([...chosen, r]); setQ(""); }} className="block w-full text-left text-sm px-3 py-2 rounded-lg hover:bg-muted text-foreground">
          + {r.title} <span className="text-muted-foreground">· {r.artist}</span>
        </button>
      ))}
      <ol className="mt-2 space-y-1">
        {chosen.map((s, i) => (
          <li key={s.id} className="flex items-center gap-2 text-sm bg-muted/50 rounded-lg px-3 py-2 text-foreground">
            <span className="flex-1 truncate">{i + 1}. {s.title}</span>
            <button aria-label="Move up" disabled={i === 0} onClick={() => { const n = [...chosen]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; persist(n); }}><ArrowUp className="w-4 h-4" /></button>
            <button aria-label="Move down" disabled={i === chosen.length - 1} onClick={() => { const n = [...chosen]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; persist(n); }}><ArrowDown className="w-4 h-4" /></button>
            <button className="text-destructive text-xs" onClick={() => persist(chosen.filter((x) => x.id !== s.id))}>Remove</button>
          </li>
        ))}
      </ol>
    </div>
  );
};

const AdminAppearance = () => {
  const { isAdmin, loading } = useIsAdmin();
  const navigate = useNavigate();
  const [theme, setTheme] = useState<ThemeColors>({});
  const [layout, setLayout] = useState<HomeSectionSetting[]>(resolveHomeLayout(null));
  const [playlists, setPlaylists] = useState<Pl[]>([]);

  useEffect(() => { if (!loading && !isAdmin) navigate("/"); }, [isAdmin, loading, navigate]);

  useEffect(() => {
    getSetting<ThemeColors>(SETTING_KEYS.theme).then((t) => setTheme(t || {}));
    getSetting<HomeSectionSetting[]>(SETTING_KEYS.homeLayout).then((l) => setLayout(resolveHomeLayout(l)));
    supabase.from("playlists").select("id,name,card_color").eq("is_visible_on_homepage", true).order("created_at", { ascending: false })
      .then(({ data }) => setPlaylists((data as Pl[]) || []));
  }, []);

  const saveTheme = async (t: ThemeColors) => {
    const { error } = await saveSetting(SETTING_KEYS.theme, t);
    if (error) return toast.error("Could not save colours");
    applyTheme(t); toast.success("Theme colours saved");
  };

  const saveLayout = async (l: HomeSectionSetting[]) => {
    setLayout(l);
    const { error } = await saveSetting(SETTING_KEYS.homeLayout, l);
    error ? toast.error("Could not save") : toast.success("Home layout saved");
  };

  const move = (i: number, d: number) => {
    const n = [...layout]; const j = i + d; if (j < 0 || j >= n.length) return;
    [n[i], n[j]] = [n[j], n[i]]; saveLayout(n);
  };

  const setCardColor = async (id: string, color: string | null) => {
    setPlaylists((p) => p.map((x) => (x.id === id ? { ...x, card_color: color } : x)));
    const { error } = await supabase.from("playlists").update({ card_color: color }).eq("id", id);
    error ? toast.error("Could not save") : toast.success("Card colour saved");
  };

  if (loading) return null;

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 py-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-serif font-bold text-foreground mb-1">Appearance & Home</h1>
        <p className="text-sm text-muted-foreground mb-5">Manage the app colours, home section order, card colours and curated songs.</p>

        <Card title="Theme colours">
          <div className="grid sm:grid-cols-2 gap-3">
            {THEME_FIELDS.map((f) => (
              <label key={f.key} className="flex items-center gap-3 text-sm text-foreground">
                <input type="color" value={theme[f.key] || f.def} onChange={(e) => setTheme({ ...theme, [f.key]: e.target.value })} className="w-10 h-10 rounded-lg bg-transparent border-0" />
                {f.label}
              </label>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={() => saveTheme(theme)}>Save colours</Button>
            <Button variant="outline" onClick={() => { saveTheme({}); window.location.reload(); }}>Reset to default</Button>
          </div>
        </Card>

        <Card title="Home page sections">
          <ul className="space-y-1">
            {layout.map((s, i) => (
              <li key={s.id} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2 text-sm text-foreground">
                <span className="flex-1">{HOME_SECTIONS.find((h) => h.id === s.id)?.label}</span>
                <button aria-label="Move up" onClick={() => move(i, -1)}><ArrowUp className="w-4 h-4" /></button>
                <button aria-label="Move down" onClick={() => move(i, 1)}><ArrowDown className="w-4 h-4" /></button>
                <Switch checked={s.visible} onCheckedChange={(v) => saveLayout(layout.map((x) => (x.id === s.id ? { ...x, visible: v } : x)))} />
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Playlist card colours">
          <p className="text-xs text-muted-foreground mb-3">Used on the home card and its playlist page. Global playlists without a colour use deep purple.</p>
          <ul className="space-y-2">
            {playlists.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-xl p-2" style={{ background: cardGradient(p.card_color || DEFAULT_GLOBAL_CARD) }}>
                <input type="color" value={p.card_color || DEFAULT_GLOBAL_CARD} onChange={(e) => setCardColor(p.id, e.target.value)} className="w-9 h-9 rounded-lg bg-transparent border-0" />
                <span className="flex-1 text-sm text-foreground truncate">{p.name}</span>
                {p.card_color && <button className="text-xs text-foreground underline" onClick={() => setCardColor(p.id, null)}>Clear</button>}
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Curated songs">
          <SongPicker settingKey={SETTING_KEYS.curatedVideos} label="Music Videos For You" />
          <SongPicker settingKey={SETTING_KEYS.curatedKaraoke} label="Soundtrack For Your Day" />
        </Card>
      </div>
    </AppLayout>
  );
};

export default AdminAppearance;
