import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import SettingSongPicker from "@/components/admin/SettingSongPicker";
import AppUpdateEditor from "@/components/admin/AppUpdateEditor";
import StageLibraryEditor from "@/components/admin/StageLibraryEditor";
import { stageLibrary } from "@/lib/stageBackgrounds";
import { ArrowDown, ArrowUp, Image, Loader2, Upload, Video } from "lucide-react";
import { toast } from "sonner";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  applyTheme, cardGradient, DEFAULT_GLOBAL_CARD, DEFAULT_STAGE_MODE, getSetting, HOME_SECTIONS, resolveHomeLayout, resolveStageMediaUrl, saveSetting, SETTING_KEYS,
  DEFAULT_DAILY_DISCOVER_COLOR, type DailyDiscoverConfig, type HomeSectionSetting, type StageModeSetting, type ThemeColors,
} from "@/lib/siteSettings";
import { sortSongsByTitle } from "@/lib/utils";

const THEME_FIELDS: { key: keyof ThemeColors; label: string; def: string }[] = [
  { key: "gold", label: "Main accent (gold)", def: "#d4a72c" },
  { key: "background", label: "App background", def: "#090e16" },
  { key: "accent", label: "Secondary accent (blue)", def: "#24508f" },
  { key: "dailyDiscover", label: "Daily Discover background", def: "#39ff14" },
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

const DailyDiscoverEditor = () => {
  const [cfg, setCfg] = useState<DailyDiscoverConfig>({});
  useEffect(() => { getSetting<DailyDiscoverConfig>(SETTING_KEYS.dailyDiscoverConfig).then((v) => setCfg(v || {})); }, []);
  const save = async () => {
    const { error } = await saveSetting(SETTING_KEYS.dailyDiscoverConfig, cfg);
    error ? toast.error("Could not save") : toast.success("Daily Discover saved");
  };
  const color = cfg.cardColor || DEFAULT_DAILY_DISCOVER_COLOR;
  return (
    <div className="space-y-3">
      <Input value={cfg.title || ""} onChange={(e) => setCfg({ ...cfg, title: e.target.value })} placeholder="Title (default: Daily Discover)" />
      <Input value={cfg.subtitle || ""} onChange={(e) => setCfg({ ...cfg, subtitle: e.target.value })} placeholder="Subtitle / description" />
      <Input value={cfg.coverUrl || ""} onChange={(e) => setCfg({ ...cfg, coverUrl: e.target.value })} placeholder="Cover image link (optional — defaults to first song)" />
      <div className="flex items-center gap-3">
        <input type="color" value={color} onChange={(e) => setCfg({ ...cfg, cardColor: e.target.value })} className="w-10 h-10 rounded-lg bg-transparent border-0" aria-label="Daily Discover colour" />
        <div className="flex-1 h-12 rounded-xl" style={{ background: cardGradient(color) }} />
        <Button variant="outline" size="sm" onClick={() => setCfg({ ...cfg, cardColor: undefined })}>Reset</Button>
        <Button size="sm" onClick={save}>Save</Button>
      </div>
      <SettingSongPicker settingKey={SETTING_KEYS.dailyDiscoverSongs} label="Daily Discover songs" />
    </div>
  );
};

const AdminAppearance = () => {
  const { isAdmin, loading } = useIsAdmin();
  const navigate = useNavigate();
  const [theme, setTheme] = useState<ThemeColors>({});
  const [layout, setLayout] = useState<HomeSectionSetting[]>(resolveHomeLayout(null));
  const [playlists, setPlaylists] = useState<Pl[]>([]);
  const [stage, setStage] = useState<StageModeSetting>(DEFAULT_STAGE_MODE);
  const [stageEditor, setStageEditor] = useState<StageModeSetting>(DEFAULT_STAGE_MODE);
  const [stageSongId, setStageSongId] = useState("global");
  const [stageSongs, setStageSongs] = useState<SongLite[]>([]);
  const [stageUploading, setStageUploading] = useState(false);

  useEffect(() => { if (!loading && !isAdmin) navigate("/"); }, [isAdmin, loading, navigate]);

  useEffect(() => {
    getSetting<ThemeColors>(SETTING_KEYS.theme).then((t) => setTheme(t || {}));
    getSetting<HomeSectionSetting[]>(SETTING_KEYS.homeLayout).then((l) => setLayout(resolveHomeLayout(l)));
    getSetting<StageModeSetting>(SETTING_KEYS.stageMode).then((s) => {
      const next = { ...DEFAULT_STAGE_MODE, ...(s || {}) };
      setStage(next);
      setStageEditor(next);
    });
    supabase.from("playlists").select("id,name,card_color").eq("is_visible_on_homepage", true).order("created_at", { ascending: false })
      .then(({ data }) => setPlaylists((data as Pl[]) || []));
    supabase.from("songs").select("id,title,artist").limit(500)
      .then(({ data }) => setStageSongs(sortSongsByTitle((data as SongLite[]) || [])));
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

  const [globalColor, setGlobalColor] = useState(DEFAULT_GLOBAL_CARD);
  useEffect(() => { getSetting<string>(SETTING_KEYS.globalCardColor).then((v) => v && setGlobalColor(v)); }, []);
  const saveGlobalColor = async (c: string) => {
    setGlobalColor(c);
    const { error } = await saveSetting(SETTING_KEYS.globalCardColor, c);
    error ? toast.error("Could not save") : toast.success("Global card colour saved");
  };

  const setCardColor = async (id: string, color: string | null) => {
    setPlaylists((p) => p.map((x) => (x.id === id ? { ...x, card_color: color } : x)));
    const { error } = await supabase.from("playlists").update({ card_color: color }).eq("id", id);
    error ? toast.error("Could not save") : toast.success("Card colour saved");
  };

  const chooseStageTarget = (songId: string) => {
    setStageSongId(songId);
    setStageEditor(songId === "global"
      ? { ...DEFAULT_STAGE_MODE, ...stage }
      : { ...DEFAULT_STAGE_MODE, ...(stage.songOverrides?.[songId] || stage) });
  };

  const saveStage = async (presentation = stageEditor) => {
    const clean = {
      backgroundColor: presentation.backgroundColor,
      mediaType: presentation.mediaType,
      mediaUrl: presentation.mediaUrl,
    };
    const next = stageSongId === "global"
      ? { ...stage, ...clean }
      : { ...stage, songOverrides: { ...(stage.songOverrides || {}), [stageSongId]: clean } };
    setStage(next);
    setStageEditor({ ...DEFAULT_STAGE_MODE, ...clean });
    const { error } = await saveSetting(SETTING_KEYS.stageMode, next);
    error ? toast.error("Could not save Stage Mode") : toast.success("Stage Mode saved");
  };

  const resetStageTarget = async () => {
    if (stageSongId === "global") {
      setStageEditor(DEFAULT_STAGE_MODE);
      await saveStage(DEFAULT_STAGE_MODE);
      return;
    }
    const overrides = { ...(stage.songOverrides || {}) };
    delete overrides[stageSongId];
    const next = { ...stage, songOverrides: overrides };
    setStage(next);
    setStageEditor({ ...DEFAULT_STAGE_MODE, ...stage });
    const { error } = await saveSetting(SETTING_KEYS.stageMode, next);
    error ? toast.error("Could not reset song background") : toast.success("Song now uses the global background");
  };

  const uploadStageMedia = async (file?: File) => {
    if (!file) return;
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (!isVideo && !isImage) return toast.error("Choose an image or video file");
    setStageUploading(true);
    const extension = file.name.split(".").pop() || (isVideo ? "mp4" : "jpg");
    const path = `stage/${Date.now()}.${extension}`;
    const { error } = await supabase.storage.from("song-covers").upload(path, file, { contentType: file.type, upsert: false });
    if (error) {
      setStageUploading(false);
      toast.error("Upload failed");
      return;
    }
    const publicUrl = supabase.storage.from("song-covers").getPublicUrl(path).data.publicUrl;
    await saveStage({ ...stageEditor, mediaType: isVideo ? "video" : "image", mediaUrl: publicUrl });
    setStageUploading(false);
  };

  const saveStageLibrary = async (library: StageModeSetting["backgroundLibrary"], message: string) => {
    const next = { ...stage, backgroundLibrary: library };
    setStage(next);
    const { error } = await saveSetting(SETTING_KEYS.stageMode, next);
    if (error) { toast.error("Could not save backgrounds"); return false; }
    toast.success(message);
    return true;
  };

  const useLibraryForAll = async (choice: NonNullable<StageModeSetting["backgroundLibrary"]>[number]) => {
    const next = { ...stage, backgroundColor: choice.backgroundColor, mediaType: choice.mediaType, mediaUrl: choice.mediaUrl };
    setStage(next);
    if (stageSongId === "global") setStageEditor({ ...DEFAULT_STAGE_MODE, ...next });
    const { error } = await saveSetting(SETTING_KEYS.stageMode, next);
    error ? toast.error("Could not set default background") : toast.success(`${choice.name} is now the default for all songs`);
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

        <Card title="Stage Mode background">
          <p className="text-xs text-foreground mb-4">Choose a colour, image, or looping video behind the lyrics. A dark layer keeps lyrics readable.</p>
          <Select value={stageSongId} onValueChange={chooseStageTarget}>
            <SelectTrigger className="mb-4"><SelectValue placeholder="Choose global or a song" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="global">All songs (global background)</SelectItem>
              {stageSongs.map((song) => <SelectItem key={song.id} value={song.id}>{song.title} · {song.artist}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="grid sm:grid-cols-[1fr_1.5fr] gap-4">
            <div className="space-y-3">
              <label className="flex items-center gap-3 text-sm text-foreground">
                <input type="color" value={stageEditor.backgroundColor} onChange={(e) => setStageEditor({ ...stageEditor, backgroundColor: e.target.value })} className="w-10 h-10 rounded-lg bg-transparent border-0" />
                Background colour
              </label>
              <div className="grid grid-cols-3 gap-2" role="group" aria-label="Stage background type">
                {([
                  { id: "none", label: "Colour", Icon: Image },
                  { id: "image", label: "Image", Icon: Image },
                  { id: "video", label: "Video", Icon: Video },
                ] as const).map(({ id, label, Icon }) => (
                  <Button key={id} type="button" size="sm" variant={stageEditor.mediaType === id ? "default" : "outline"} onClick={() => setStageEditor({ ...stageEditor, mediaType: id })} className="gap-1 px-2">
                    <Icon className="w-3.5 h-3.5" /> {label}
                  </Button>
                ))}
              </div>
              {stageEditor.mediaType !== "none" && (
                <Input value={stageEditor.mediaUrl} onChange={(e) => setStageEditor({ ...stageEditor, mediaUrl: e.target.value })} placeholder={`Paste ${stageEditor.mediaType} link`} type="url" />
              )}
              <label className="flex items-center justify-center gap-2 h-10 rounded-md border border-input bg-background text-sm text-foreground cursor-pointer hover:bg-muted">
                {stageUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {stageUploading ? "Uploading…" : "Upload image or video"}
                <input type="file" accept="image/*,video/*" className="sr-only" disabled={stageUploading} onChange={(e) => uploadStageMedia(e.target.files?.[0])} />
              </label>
              <div className="flex gap-2">
                <Button onClick={() => saveStage()}>Save Stage Mode</Button>
                <Button variant="outline" onClick={resetStageTarget}>{stageSongId === "global" ? "Reset" : "Use global"}</Button>
              </div>
            </div>
            <div className="relative aspect-video overflow-hidden rounded-xl border border-border" style={{ backgroundColor: stageEditor.backgroundColor }}>
              {stageEditor.mediaType === "image" && stageEditor.mediaUrl && <img src={resolveStageMediaUrl(stageEditor.mediaUrl)} alt="Stage background preview" className="absolute inset-0 w-full h-full object-cover" />}
              {stageEditor.mediaType === "video" && stageEditor.mediaUrl && <video src={resolveStageMediaUrl(stageEditor.mediaUrl)} muted loop autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />}
              <div className="absolute inset-0 bg-background/55" />
              <p className="absolute inset-0 flex items-center justify-center px-5 text-center font-serif font-bold text-foreground">Your lyrics will appear here</p>
            </div>
          </div>
        </Card>

        <Card title="Stage Mode backgrounds for all songs">
          <StageLibraryEditor
            library={stageLibrary(stage)}
            onSave={saveStageLibrary}
            onUseForAll={useLibraryForAll}
            globalMediaUrl={stage.mediaType === "none" ? undefined : stage.mediaUrl}
          />
        </Card>

        <Card title="Playlist card colours">
          <p className="text-xs text-foreground mb-3">Used on the home card and its playlist page. Playlists without their own colour use the global colour below.</p>
          <div className="rounded-2xl p-3 mb-4 border border-gold/20" style={{ background: cardGradient(globalColor) }}>
            <div className="flex items-center gap-3">
              <input type="color" value={globalColor} onChange={(e) => setGlobalColor(e.target.value)} onBlur={(e) => saveGlobalColor(e.target.value)} className="w-10 h-10 rounded-lg bg-transparent border-0" aria-label="Global card colour" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Global card colour</p>
                <p className="text-xs text-foreground/90">Live preview · {globalColor.toUpperCase()}</p>
              </div>
              <button className="text-xs text-foreground underline" onClick={() => saveGlobalColor(globalColor)}>Save</button>
              <button className="text-xs text-foreground underline" onClick={() => saveGlobalColor(DEFAULT_GLOBAL_CARD)}>Reset</button>
            </div>
          </div>
          <ul className="space-y-2">
            {playlists.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-xl p-2" style={{ background: cardGradient(p.card_color || globalColor) }}>
                <input type="color" value={p.card_color || globalColor} onChange={(e) => setCardColor(p.id, e.target.value)} className="w-9 h-9 rounded-lg bg-transparent border-0" />
                <span className="flex-1 text-sm text-foreground truncate">{p.name}</span>
                {p.card_color && <button className="text-xs text-foreground underline" onClick={() => setCardColor(p.id, null)}>Clear</button>}
              </li>
            ))}
          </ul>
        </Card>

        <Card title="App update popup">
          <AppUpdateEditor />
        </Card>

        <Card title="Daily Discover">
          <DailyDiscoverEditor />
        </Card>

        <Card title="Curated songs">
          <SettingSongPicker settingKey={SETTING_KEYS.curatedVideos} label="Music Videos For You" />
          <p className="text-xs text-muted-foreground">Quick Picks, Recommended Playlists, Soundtrack For Your Day, Categories and Global Playlists are managed in <Link to="/admin/home-sections" className="underline">Home Sections</Link>.</p>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AdminAppearance;
