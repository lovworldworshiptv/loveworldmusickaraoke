import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Download, Mic2, Play, Pause, Trash2, WifiOff, HardDrive, Shuffle, CloudDownload, Pencil, Check, Lock } from "lucide-react";
import { toast } from "sonner";
import AppLayout from "@/components/layout/AppLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/loading-skeleton";
import { usePlayer, type PlayerSong } from "@/contexts/PlayerContext";
import { useAuth } from "@/contexts/AuthContext";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { supabase } from "@/integrations/supabase/client";
import {
  getDownloadedMeta, getDownloadedAudioUrl, getDownloadedInstrumentalUrl, removeDownload, type DownloadedTrack,
} from "@/lib/downloadManager";
import { checkPlaybackAllowed, revalidateLicense } from "@/lib/offlineLicense";
import {
  listStudioRecordings, getStudioRecordingBlob, deleteStudioRecording, renameStudioRecording,
  saveStudioRecording, formatBytes, type StudioRecording,
} from "@/lib/studioStore";

const LICENSE_KEY = "lmk_offline_licenses";
function licenseDaysLeft(id: string): number | null {
  try {
    const l = JSON.parse(localStorage.getItem(LICENSE_KEY) || "{}")[id];
    if (!l) return null;
    return Math.ceil((new Date(l.offlineLicenseExpiryDate).getTime() - Date.now()) / 86400000);
  } catch { return null; }
}

const fmtDate = (t: number | string) =>
  new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

const Studio = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isOnline = useOnlineStatus();
  const { playSong, currentSong, isPlaying, togglePlay } = usePlayer();

  const [downloads, setDownloads] = useState<DownloadedTrack[]>([]);
  const [recordings, setRecordings] = useState<StudioRecording[]>([]);
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const [playingRec, setPlayingRec] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
  const [savingCloud, setSavingCloud] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const refresh = useCallback(async () => {
    const [d, r] = await Promise.all([getDownloadedMeta().catch(() => []), listStudioRecordings().catch(() => [])]);
    setDownloads(d.sort((a, b) => b.downloadedAt - a.downloadedAt));
    setRecordings(r);
    if (navigator.storage?.estimate) {
      const e = await navigator.storage.estimate();
      setStorage({ usage: e.usage ?? 0, quota: e.quota ?? 0 });
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => () => { audioRef.current?.pause(); }, []);

  // Cloud recordings from the last 24h that can be kept on this device
  const { data: cloudRecs = [] } = useQuery({
    queryKey: ["studio-cloud-recs", user?.id],
    enabled: !!user && isOnline,
    queryFn: async () => {
      const { data } = await supabase.from("karaoke_recordings")
        .select("id, song_id, song_title, audio_url, caption, created_at")
        .eq("user_id", user!.id)
        .gte("created_at", new Date(Date.now() - 24 * 3600000).toISOString())
        .order("created_at", { ascending: false });
      return data || [];
    },
  });
  const unsavedCloud = cloudRecs.filter((c) => !recordings.some((r) => r.id === c.id));

  const playOffline = async (track: DownloadedTrack, queue = false) => {
    const check = checkPlaybackAllowed(track.id);
    if (check.allowed === false) {
      if (check.reason === "needs_validation" && isOnline && user) {
        const re = await revalidateLicense(track.id, user.id);
        if (re.allowed === false) { toast.error(re.message); return false; }
      } else {
        toast.error(check.message);
        if (check.reason === "expired") navigate("/subscription");
        return false;
      }
    }
    const url = await getDownloadedAudioUrl(track.id);
    if (!url) { toast.error("This song is missing from your device"); return false; }
    const instrumentalUrl = await getDownloadedInstrumentalUrl(track.id);
    const song: PlayerSong = {
      id: track.id, title: track.title, artist: track.artist, coverUrl: track.coverUrl,
      audioUrl: url, instrumentalUrl: instrumentalUrl || undefined, lyricsLrc: track.lyricsLrc,
      durationSeconds: track.durationSeconds,
    };
    if (!queue) playSong(song);
    return song;
  };

  const shufflePlay = async () => {
    if (!downloads.length) return;
    const pick = downloads[Math.floor(Math.random() * downloads.length)];
    await playOffline(pick);
  };

  const remove = async (id: string) => {
    await removeDownload(id);
    toast.success("Removed from device");
    refresh();
  };

  const toggleRec = async (rec: StudioRecording) => {
    if (playingRec === rec.id) { audioRef.current?.pause(); setPlayingRec(null); return; }
    audioRef.current?.pause();
    const blob = await getStudioRecordingBlob(rec.id);
    if (!blob) { toast.error("Recording not found"); return; }
    if (isPlaying) togglePlay();
    const a = new Audio(URL.createObjectURL(blob));
    a.onended = () => setPlayingRec(null);
    audioRef.current = a;
    a.play().then(() => setPlayingRec(rec.id)).catch(() => toast.error("Couldn't play recording"));
  };

  const exportRec = async (rec: StudioRecording) => {
    const blob = await getStudioRecordingBlob(rec.id);
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${rec.songTitle} - my karaoke.${rec.mimeType.includes("mp4") ? "m4a" : "webm"}`;
    a.click();
  };

  const deleteRec = async (id: string) => {
    if (playingRec === id) { audioRef.current?.pause(); setPlayingRec(null); }
    await deleteStudioRecording(id);
    toast.success("Recording deleted");
    refresh();
  };

  const saveRename = async () => {
    if (!editing) return;
    await renameStudioRecording(editing.id, editing.value.trim());
    setEditing(null);
    refresh();
  };

  const keepCloud = async (c: (typeof cloudRecs)[number]) => {
    setSavingCloud(c.id);
    try {
      const res = await fetch(c.audio_url);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      await saveStudioRecording(blob, {
        id: c.id, songId: c.song_id, songTitle: c.song_title, caption: c.caption || undefined,
        createdAt: new Date(c.created_at).getTime(),
      });
      toast.success("Saved to your Studio");
      refresh();
    } catch {
      toast.error("Couldn't save this recording");
    } finally { setSavingCloud(null); }
  };

  const recBytes = recordings.reduce((s, r) => s + r.sizeBytes, 0);

  return (
    <AppLayout>
      <div className="px-4 md:px-8 py-6 max-w-4xl mx-auto space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">My Studio</h1>
          <p className="text-sm text-muted-foreground">Your offline songs and karaoke recordings, kept on this device.</p>
        </header>

        <div className="glass-card rounded-2xl p-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <HardDrive className="w-5 h-5 text-gold" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between text-sm">
              <span className="text-foreground font-medium">{downloads.length} songs · {recordings.length} recordings</span>
              {storage && <span className="text-muted-foreground">{formatBytes(storage.usage)} used</span>}
            </div>
            {storage && storage.quota > 0 && (
              <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-gold" style={{ width: `${Math.min(100, Math.max(1, (storage.usage / storage.quota) * 100))}%` }} />
              </div>
            )}
          </div>
          {!isOnline && <span className="flex items-center gap-1 text-xs text-gold"><WifiOff className="w-3.5 h-3.5" /> Offline</span>}
        </div>

        <Tabs defaultValue="offline">
          <TabsList className="rounded-xl">
            <TabsTrigger value="offline" className="rounded-lg"><Download className="w-4 h-4 mr-1.5" /> Offline songs</TabsTrigger>
            <TabsTrigger value="recordings" className="rounded-lg"><Mic2 className="w-4 h-4 mr-1.5" /> Recordings</TabsTrigger>
          </TabsList>

          <TabsContent value="offline" className="space-y-3 mt-4">
            {downloads.length === 0 ? (
              <EmptyState icon={Download} title="No offline songs yet" description="Download songs from your Library to listen without internet." />
            ) : (
              <>
                <Button onClick={shufflePlay} className="rounded-full bg-gold text-primary-foreground hover:bg-gold/90">
                  <Shuffle className="w-4 h-4 mr-2" /> Shuffle offline
                </Button>
                <ul className="space-y-2">
                  {downloads.map((t) => {
                    const days = licenseDaysLeft(t.id);
                    const active = currentSong?.id === t.id;
                    return (
                      <li key={t.id} className="glass-card rounded-2xl p-3 flex items-center gap-3">
                        <button onClick={() => playOffline(t)} className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-muted">
                          {t.coverUrl && <img src={t.coverUrl} alt="" className="w-full h-full object-cover" />}
                          <span className="absolute inset-0 flex items-center justify-center bg-background/40">
                            <Play className="w-4 h-4 text-foreground" />
                          </span>
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${active ? "text-gold" : "text-foreground"}`}>{t.title}</p>
                          <p className="text-xs text-foreground truncate">
                            {t.artist} · {t.isFreeDownload ? "Free" : days === null ? "Saved" : days > 0 ? `${days} day${days === 1 ? "" : "s"} left offline` : "Reconnect to renew"}
                          </p>
                        </div>
                        {days !== null && days <= 0 && <Lock className="w-4 h-4 text-muted-foreground" />}
                        <Button size="icon" variant="ghost" onClick={() => remove(t.id)} aria-label="Remove from device">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </TabsContent>

          <TabsContent value="recordings" className="space-y-4 mt-4">
            {unsavedCloud.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-sm font-semibold text-foreground">Shared in the last 24 hours</h2>
                <p className="text-xs text-muted-foreground">Shared recordings disappear after 24 hours. Keep them here for good.</p>
                {unsavedCloud.map((c) => (
                  <div key={c.id} className="glass-card rounded-2xl p-3 flex items-center gap-3">
                    <Mic2 className="w-5 h-5 text-gold shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{c.song_title}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.caption || fmtDate(c.created_at)}</p>
                    </div>
                    <Button size="sm" variant="outline" className="rounded-full" disabled={savingCloud === c.id} onClick={() => keepCloud(c)}>
                      <CloudDownload className="w-4 h-4 mr-1.5" /> {savingCloud === c.id ? "Saving…" : "Keep"}
                    </Button>
                  </div>
                ))}
              </section>
            )}

            {recordings.length === 0 ? (
              <EmptyState icon={Mic2} title="No recordings in your Studio" description="Sing in Karaoke mode, then tap “Save to my Studio” to keep it here." />
            ) : (
              <section className="space-y-2">
                <h2 className="text-sm font-semibold text-foreground">On this device · {formatBytes(recBytes)}</h2>
                {recordings.map((r) => (
                  <div key={r.id} className="glass-card rounded-2xl p-3 flex items-center gap-3">
                    <Button size="icon" onClick={() => toggleRec(r)} className="rounded-full bg-gold text-primary-foreground hover:bg-gold/90 shrink-0" aria-label={playingRec === r.id ? "Pause" : "Play"}>
                      {playingRec === r.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>
                    <div className="flex-1 min-w-0">
                      {editing?.id === r.id ? (
                        <div className="flex gap-1">
                          <Input autoFocus value={editing.value} maxLength={80} onChange={(e) => setEditing({ id: r.id, value: e.target.value })}
                            onKeyDown={(e) => e.key === "Enter" && saveRename()} className="h-8 text-sm" />
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={saveRename} aria-label="Save name"><Check className="w-4 h-4" /></Button>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm font-medium text-foreground truncate">{r.caption || r.songTitle}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {r.caption ? `${r.songTitle} · ` : ""}{fmtDate(r.createdAt)} · {formatBytes(r.sizeBytes)}
                          </p>
                        </>
                      )}
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => setEditing({ id: r.id, value: r.caption || "" })} aria-label="Rename"><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => exportRec(r)} aria-label="Save as file"><Download className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteRec(r.id)} aria-label="Delete"><Trash2 className="w-4 h-4" /></Button>
                  </div>
                ))}
              </section>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Studio;
