import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Check, Languages, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

interface LyricRow { id: string; language_code: string; lyrics_lrc: string | null; lyrics_text: string | null; is_machine_translated: boolean; is_verified: boolean }
interface AudioRow { id: string; language_code: string; audio_url: string | null; status: string; bitrate_kbps: number | null; source: string }
interface Lang { code: string; name: string; native_name: string | null }

const AUDIO_BUCKET = "song-audio";

/** Per-song multilingual lyrics + audio versions manager (Phase 10). */
const AdminLyricsManager = ({ songId, songTitle, onClose }: { songId: string | null; songTitle?: string; onClose: () => void }) => {
  const { isAdmin } = useIsAdmin();
  const [lyrics, setLyrics] = useState<LyricRow[]>([]);
  const [audio, setAudio] = useState<AudioRow[]>([]);
  const [langs, setLangs] = useState<Lang[]>([]);
  const [tab, setTab] = useState<"lyrics" | "audio">("lyrics");
  const [drafts, setDrafts] = useState<Record<string, Partial<LyricRow>>>({});
  const [newLang, setNewLang] = useState<string>("");
  const [audioLang, setAudioLang] = useState<string>("en");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!songId) return;
    const [{ data: l }, { data: a }, { data: ls }] = await Promise.all([
      supabase.from("song_lyrics").select("id, language_code, lyrics_lrc, lyrics_text, is_machine_translated, is_verified").eq("song_id", songId),
      supabase.from("song_audio_versions").select("id, language_code, audio_url, status, bitrate_kbps, source").eq("song_id", songId).eq("kind", "full"),
      supabase.from("languages").select("code, name, native_name").eq("is_active", true).order("sort_order"),
    ]);
    setLyrics((l || []) as LyricRow[]);
    setAudio((a || []) as AudioRow[]);
    setLangs((ls || []) as Lang[]);
  }, [songId]);

  useEffect(() => { load(); setTab("lyrics"); }, [load]);

  if (!songId) return null;

  const langName = (code: string) => {
    const l = langs.find((x) => x.code === code);
    return l?.name || code.toUpperCase();
  };

  const draftFor = (r: LyricRow) => drafts[r.id] ?? { lyrics_lrc: r.lyrics_lrc, lyrics_text: r.lyrics_text, is_machine_translated: r.is_machine_translated, is_verified: r.is_verified };

  const saveLyric = async (r: LyricRow) => {
    const d = draftFor(r);
    setSaving(r.id);
    const { error } = await supabase.from("song_lyrics").update({
      lyrics_lrc: d.lyrics_lrc ?? null,
      lyrics_text: d.lyrics_text ?? null,
      is_machine_translated: !!d.is_machine_translated,
      is_verified: !!d.is_verified,
      updated_at: new Date().toISOString(),
    }).eq("id", r.id);
    setSaving(null);
    if (error) { toast.error("Could not save lyrics"); return; }
    toast.success(`${langName(r.language_code)} lyrics saved`);
    load();
  };

  const addLanguage = async () => {
    if (!songId || !newLang) return;
    if (lyrics.some((l) => l.language_code === newLang)) { toast.error("That language already exists"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("song_lyrics").insert({
      song_id: songId, language_code: newLang, lyrics_lrc: null, lyrics_text: null,
      is_machine_translated: false, is_verified: false, created_by: user?.id || null,
    });
    if (error) { toast.error("Could not add language"); return; }
    setNewLang("");
    load();
    toast.success("Language added — paste the lyrics");
  };

  const deleteLyric = async (r: LyricRow) => {
    await supabase.from("song_lyrics").delete().eq("id", r.id);
    load();
  };

  const uploadAudio = async (file: File) => {
    if (!songId || !audioLang) return;
    setUploading(true);
    const ext = (file.name.split(".").pop() || "mp3").toLowerCase();
    const path = `${songId}/${audioLang}-full-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from(AUDIO_BUCKET).upload(path, file, { upsert: false, contentType: file.type || "audio/mpeg" });
    if (upErr) { setUploading(false); toast.error("Upload failed: " + upErr.message); return; }
    const { data: { publicUrl } } = supabase.storage.from(AUDIO_BUCKET).getPublicUrl(path);
    const { error } = await supabase.from("song_audio_versions").insert({
      song_id: songId, kind: "full", language_code: audioLang, audio_url: publicUrl, status: "ready", source: "manual",
    });
    setUploading(false);
    if (error) { toast.error("Could not register the audio version"); return; }
    toast.success(`${langName(audioLang)} audio uploaded`);
    load();
  };

  const deleteAudio = async (row: AudioRow) => {
    await supabase.from("song_audio_versions").delete().eq("id", row.id);
    load();
  };

  const availableLangs = langs.filter((l) => !lyrics.some((r) => r.language_code === l.code));

  return (
    <Dialog open={!!songId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="glass-card border-gold/20 rounded-2xl max-w-2xl max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-foreground">Lyrics & Languages</DialogTitle>
          <p className="text-xs text-foreground/70 truncate">{songTitle}</p>
        </DialogHeader>

        <div className="flex gap-2">
          <Button size="sm" variant={tab === "lyrics" ? "default" : "secondary"}
            onClick={() => setTab("lyrics")}
            className={tab === "lyrics" ? "rounded-full bg-gradient-to-r from-[#c9a227] to-[#8b6914] text-white font-semibold" : "rounded-full text-foreground"}>
            <Languages className="w-4 h-4 mr-1" /> Lyrics
          </Button>
          {isAdmin && (
            <Button size="sm" variant={tab === "audio" ? "default" : "secondary"}
              onClick={() => setTab("audio")}
              className={tab === "audio" ? "rounded-full bg-gradient-to-r from-[#c9a227] to-[#8b6914] text-white font-semibold" : "rounded-full text-foreground"}>
              Audio versions
            </Button>
          )}
        </div>

        {tab === "lyrics" && (
          <div className="space-y-4">
            {lyrics.length === 0 && <p className="text-sm text-foreground/60">No lyrics yet — add a language below.</p>}
            {lyrics.map((r) => {
              const d = draftFor(r);
              return (
                <div key={r.id} className="border border-border/60 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gold">{langName(r.language_code)}</p>
                    <button onClick={() => deleteLyric(r)} className="p-1.5 rounded-full hover:bg-destructive/10 text-foreground/60 hover:text-destructive" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                  <textarea value={d.lyrics_lrc || ""} rows={4}
                    onChange={(e) => setDrafts((s) => ({ ...s, [r.id]: { ...d, lyrics_lrc: e.target.value } }))}
                    placeholder="Timed lyrics in [mm:ss.xx] format (LRC)"
                    className="w-full bg-secondary/50 border border-border rounded-lg p-2 text-xs text-foreground font-mono resize-y outline-none focus:border-gold/50" />
                  <textarea value={d.lyrics_text || ""} rows={2}
                    onChange={(e) => setDrafts((s) => ({ ...s, [r.id]: { ...d, lyrics_text: e.target.value } }))}
                    placeholder="Plain text lyrics (no timestamps)"
                    className="w-full bg-secondary/50 border border-border rounded-lg p-2 text-xs text-foreground resize-y outline-none focus:border-gold/50" />
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-1.5 text-xs text-foreground/80">
                        <Switch checked={!!d.is_machine_translated} onCheckedChange={(v) => setDrafts((s) => ({ ...s, [r.id]: { ...d, is_machine_translated: v } }))} />
                        Auto-translated
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-foreground/80">
                        <Switch checked={!!d.is_verified} onCheckedChange={(v) => setDrafts((s) => ({ ...s, [r.id]: { ...d, is_verified: v } }))} />
                        Verified
                      </label>
                    </div>
                    <Button size="sm" onClick={() => saveLyric(r)} disabled={saving === r.id}
                      className="rounded-full bg-gradient-to-r from-[#c9a227] to-[#8b6914] text-white font-semibold">
                      {saving === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-1" />} Save
                    </Button>
                  </div>
                </div>
              );
            })}
            <div className="flex items-center gap-2">
              <Select value={newLang} onValueChange={setNewLang}>
                <SelectTrigger className="bg-secondary/50 border-border text-foreground text-sm w-52"><SelectValue placeholder="Add a language..." /></SelectTrigger>
                <SelectContent>{availableLangs.map((l) => <SelectItem key={l.code} value={l.code}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
              <Button size="sm" onClick={addLanguage} disabled={!newLang} className="rounded-full border border-gold/40 bg-gold/10 text-gold hover:bg-gold/20">
                <Plus className="w-4 h-4 mr-1" /> Add language
              </Button>
            </div>
          </div>
        )}

        {tab === "audio" && isAdmin && (
          <div className="space-y-4">
            {audio.length === 0 && <p className="text-sm text-foreground/60">Only the main audio file exists.</p>}
            {audio.map((r) => (
              <div key={r.id} className="flex items-center justify-between border border-border/60 rounded-xl p-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{langName(r.language_code)}</p>
                  <p className="text-[11px] text-foreground/60">{r.status} · {r.bitrate_kbps ? `${r.bitrate_kbps}kbps` : r.source}</p>
                </div>
                <div className="flex items-center gap-1">
                  {r.audio_url && <a href={r.audio_url} target="_blank" rel="noreferrer" className="text-xs text-gold underline mr-2">listen</a>}
                  <button onClick={() => deleteAudio(r)} className="p-1.5 rounded-full hover:bg-destructive/10 text-foreground/60 hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={audioLang} onValueChange={setAudioLang}>
                <SelectTrigger className="bg-secondary/50 border-border text-foreground text-sm w-44"><SelectValue /></SelectTrigger>
                <SelectContent>{langs.map((l) => <SelectItem key={l.code} value={l.code}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
              <label className="cursor-pointer">
                <input type="file" accept="audio/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadAudio(e.target.files[0])} disabled={uploading} />
                <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 text-gold hover:bg-gold/20 px-4 py-2 text-sm font-medium">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Upload {langName(audioLang)} audio
                </span>
              </label>
            </div>
            <p className="text-[11px] text-foreground/50">Listeners who pick a preferred language in the player hear this version when it exists.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AdminLyricsManager;
