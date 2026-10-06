import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Trash2, Plus, Loader2, Upload, Film } from "lucide-react";
import { ytId } from "@/components/player/VideoMode";

interface Row { id: string; video_url: string; video_type: string; language_code: string; offset_ms: number; is_active: boolean }
const TYPES = ["official", "lyric", "live", "karaoke"];

interface Props { songId: string | null; songTitle?: string; onClose: () => void }

interface MotionArtwork { id: string; video_url: string; duration_seconds: number; is_active: boolean }

/** Admin dialog to attach, toggle and remove videos for a song. */
const SongVideosManager = ({ songId, songTitle, onClose }: Props) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [langs, setLangs] = useState<{ code: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState("");
  const [type, setType] = useState("official");
  const [lang, setLang] = useState("en");
  const [offset, setOffset] = useState("0");
  const [saving, setSaving] = useState(false);
  const [motion, setMotion] = useState<MotionArtwork | null>(null);
  const [motionUrl, setMotionUrl] = useState("");
  const [motionDuration, setMotionDuration] = useState<number | null>(null);
  const [motionSaving, setMotionSaving] = useState(false);

  const load = async () => {
    if (!songId) return;
    setLoading(true);
    const [{ data }, { data: motionData }] = await Promise.all([
      supabase.from("song_videos").select("id, video_url, video_type, language_code, offset_ms, is_active").eq("song_id", songId).order("created_at"),
      supabase.from("song_motion_artwork").select("id, video_url, duration_seconds, is_active").eq("song_id", songId).maybeSingle(),
    ]);
    setRows((data as Row[]) || []);
    const artwork = motionData as MotionArtwork | null;
    setMotion(artwork);
    setMotionUrl(artwork?.video_url || "");
    setMotionDuration(artwork?.duration_seconds || null);
    setLoading(false);
  };

  const syncFlag = async (list: Row[]) => {
    if (!songId) return;
    await supabase.from("songs").update({ has_video: list.some((r) => r.is_active) }).eq("id", songId);
  };

  useEffect(() => { setUrl(""); setMotionUrl(""); setMotionDuration(null); load(); }, [songId]);
  useEffect(() => {
    supabase.from("languages").select("code, name").eq("is_active", true).order("sort_order").then(({ data }) => setLangs(data || []));
  }, []);

  const add = async () => {
    const u = url.trim();
    if (!/^https:\/\//.test(u)) { toast.error("Enter a full https:// video link"); return; }
    setSaving(true);
    const thumb = ytId(u) ? `https://img.youtube.com/vi/${ytId(u)}/hqdefault.jpg` : null;
    const { data, error } = await supabase.from("song_videos").insert({
      song_id: songId!, video_url: u, video_type: type, language_code: lang,
      offset_ms: Math.round((parseFloat(offset) || 0) * 1000), thumbnail_url: thumb, is_active: true,
    }).select("id, video_url, video_type, language_code, offset_ms, is_active").single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    const next = [...rows, data as Row];
    setRows(next); syncFlag(next); setUrl("");
    toast.success("Video added");
  };

  const toggle = async (r: Row) => {
    const { error } = await supabase.from("song_videos").update({ is_active: !r.is_active }).eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    const next = rows.map((x) => (x.id === r.id ? { ...x, is_active: !x.is_active } : x));
    setRows(next); syncFlag(next);
  };

  const remove = async (r: Row) => {
    if (!confirm("Remove this video?")) return;
    const { error } = await supabase.from("song_videos").delete().eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    const next = rows.filter((x) => x.id !== r.id);
    setRows(next); syncFlag(next);
  };

  const inspectMotion = (source: string) => new Promise<number>((resolve, reject) => {
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.onloadedmetadata = () => {
      const seconds = probe.duration;
      probe.removeAttribute("src");
      probe.load();
      if (!Number.isFinite(seconds) || seconds <= 0) reject(new Error("Could not read the video duration"));
      else resolve(seconds);
    };
    probe.onerror = () => reject(new Error("Could not load this video"));
    probe.src = source;
  });

  const chooseMotionFile = async (file: File) => {
    const localUrl = URL.createObjectURL(file);
    try {
      const seconds = await inspectMotion(localUrl);
      if (seconds > 15.05) { toast.error("Motion artwork must be 15 seconds or shorter"); return; }
      setMotionSaving(true);
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const path = `motion-${songId}-${Date.now()}-${safeName}`;
      const { error } = await supabase.storage.from("song-covers").upload(path, file, { contentType: file.type, upsert: false });
      if (error) { toast.error("Upload failed: " + error.message); return; }
      const publicUrl = supabase.storage.from("song-covers").getPublicUrl(path).data.publicUrl;
      setMotionUrl(publicUrl);
      setMotionDuration(seconds);
      toast.success("Motion artwork uploaded. Save it to apply.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not inspect this video");
    } finally {
      URL.revokeObjectURL(localUrl);
      setMotionSaving(false);
    }
  };

  const saveMotion = async () => {
    if (!songId || !motionUrl.trim()) return;
    setMotionSaving(true);
    try {
      const seconds = motionDuration ?? await inspectMotion(motionUrl.trim());
      if (seconds > 15.05) { toast.error("Motion artwork must be 15 seconds or shorter"); return; }
      const payload = { song_id: songId, video_url: motionUrl.trim(), duration_seconds: Number(seconds.toFixed(2)), is_active: true };
      const query = motion
        ? supabase.from("song_motion_artwork").update(payload).eq("id", motion.id)
        : supabase.from("song_motion_artwork").insert(payload);
      const { error } = await query;
      if (error) { toast.error(error.message); return; }
      toast.success("Motion artwork saved");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not inspect this video");
    } finally {
      setMotionSaving(false);
    }
  };

  const removeMotion = async () => {
    if (!motion || !confirm("Remove this motion artwork?")) return;
    const { error } = await supabase.from("song_motion_artwork").delete().eq("id", motion.id);
    if (error) { toast.error(error.message); return; }
    setMotion(null); setMotionUrl(""); setMotionDuration(null);
    toast.success("Motion artwork removed");
  };

  const sel = "h-10 rounded-md border border-input bg-background px-2 text-sm";

  return (
    <Dialog open={!!songId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="font-serif">Videos · {songTitle}</DialogTitle></DialogHeader>

        <div className="space-y-2">
          {loading ? <Loader2 className="w-5 h-5 animate-spin text-gold mx-auto" /> : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No videos yet. Add one below to enable Video mode for this song.</p>
          ) : rows.map((r) => (
            <div key={r.id} className="flex items-center gap-2 p-2 rounded-xl bg-secondary/40">
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{r.video_url}</p>
                <p className="text-[11px] text-muted-foreground capitalize">{r.video_type} · {r.language_code.toUpperCase()} · offset {r.offset_ms / 1000}s</p>
              </div>
              <Switch checked={r.is_active} onCheckedChange={() => toggle(r)} aria-label="Active" />
              <button onClick={() => remove(r)} className="p-2 text-muted-foreground hover:text-destructive" aria-label="Remove video"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>

        <div className="space-y-2 pt-3 border-t border-border">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium flex items-center gap-2"><Film className="w-4 h-4 text-gold" /> Motion artwork</p>
              <p className="text-[11px] text-muted-foreground">Muted looping MP4 or WebM, up to 15 seconds.</p>
            </div>
            {motion && <Button type="button" variant="ghost" size="icon" onClick={removeMotion} aria-label="Remove motion artwork"><Trash2 className="w-4 h-4 text-destructive" /></Button>}
          </div>
          {motionUrl && <video src={motionUrl} muted loop autoPlay playsInline className="w-full aspect-video rounded-lg object-cover bg-muted" />}
          <Input placeholder="Paste direct .mp4 or .webm URL" value={motionUrl} onChange={(e) => { setMotionUrl(e.target.value); setMotionDuration(null); }} />
          <div className="grid grid-cols-2 gap-2">
            <label className={`h-10 rounded-md border border-input bg-background px-3 text-sm flex items-center justify-center gap-2 cursor-pointer ${motionSaving ? "pointer-events-none opacity-50" : ""}`}>
              <Upload className="w-4 h-4" /> Upload clip
              <input type="file" accept="video/mp4,video/webm" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) chooseMotionFile(file); e.currentTarget.value = ""; }} />
            </label>
            <Button onClick={saveMotion} disabled={motionSaving || !motionUrl.trim()}>
              {motionSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Film className="w-4 h-4" />} Save artwork
            </Button>
          </div>
        </div>

        <div className="space-y-2 pt-3 border-t border-border">
          <Input placeholder="YouTube link or direct .mp4 URL" value={url} onChange={(e) => setUrl(e.target.value)} />
          <div className="grid grid-cols-3 gap-2">
            <select className={sel} value={type} onChange={(e) => setType(e.target.value)}>
              {TYPES.map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
            </select>
            <select className={sel} value={lang} onChange={(e) => setLang(e.target.value)}>
              {langs.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
            </select>
            <Input type="number" step="0.1" value={offset} onChange={(e) => setOffset(e.target.value)} title="Seconds the video is ahead (+) or behind (−) the song" />
          </div>
          <p className="text-[11px] text-muted-foreground">Offset: seconds to shift the video so it lines up with the song audio.</p>
          <Button onClick={add} disabled={saving || !url} className="w-full gradient-gold text-primary-foreground">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add video
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SongVideosManager;
