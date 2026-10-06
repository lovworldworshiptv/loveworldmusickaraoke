import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Trash2, Plus, Loader2 } from "lucide-react";
import { ytId } from "@/components/player/VideoMode";

interface Row { id: string; video_url: string; video_type: string; language_code: string; offset_ms: number; is_active: boolean }
const TYPES = ["official", "lyric", "live", "karaoke"];

interface Props { songId: string | null; songTitle?: string; onClose: () => void }

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

  const load = async () => {
    if (!songId) return;
    setLoading(true);
    const { data } = await supabase.from("song_videos").select("id, video_url, video_type, language_code, offset_ms, is_active").eq("song_id", songId).order("created_at");
    setRows((data as Row[]) || []);
    setLoading(false);
  };

  const syncFlag = async (list: Row[]) => {
    if (!songId) return;
    await supabase.from("songs").update({ has_video: list.some((r) => r.is_active) }).eq("id", songId);
  };

  useEffect(() => { setUrl(""); load(); }, [songId]);
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
