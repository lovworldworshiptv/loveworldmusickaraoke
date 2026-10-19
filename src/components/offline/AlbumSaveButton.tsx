import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsPremium } from "@/hooks/useIsPremium";
import { useSecureDownloads } from "@/hooks/useSecureDownloads";
import { saveMany } from "@/lib/downloadManager";
import { bulkProgress } from "@/lib/secureDownloads/policy";
import { cn } from "@/lib/utils";

interface Props { albumId: string; title: string; className?: string }

/** Compact "save whole album" control for album cards; songs are looked up only when tapped. */
const AlbumSaveButton = ({ albumId, title, className }: Props) => {
  const { user } = useAuth();
  const { isPremium } = useIsPremium();
  const navigate = useNavigate();
  const s = useSecureDownloads();
  const [ids, setIds] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  const byId = useMemo(() => new Map(s.items.map((i) => [i.songId, i])), [s.items]);
  const prog = ids?.length ? bulkProgress(ids, (id) => byId.get(id)?.status, (id) => s.progress[id]) : null;
  const done = !!prog && prog.pending === 0 && prog.ready === prog.total;
  const active = !!prog && prog.pending > 0;
  const pct = prog && prog.total ? Math.round((prog.ready / prog.total) * 100) : 0;

  const start = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) { navigate("/auth"); return; }
    if (busy || active) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.from("songs")
        .select("id, title, artist, cover_url, audio_url, lyrics_lrc, duration_seconds, album, is_free_download")
        .eq("album_id", albumId);
      if (error) throw error;
      const playable = (data || []).filter((x) => x.audio_url);
      const eligible = playable.filter((x) => isPremium || x.is_free_download);
      if (!eligible.length) {
        if (playable.length) { toast("Premium lets you save whole albums for offline listening."); navigate("/subscription"); }
        else toast("This album has no songs to save yet.");
        return;
      }
      setIds(eligible.map((x) => x.id));
      const todo = eligible.filter((x) => byId.get(x.id)?.status !== "ready");
      if (!todo.length) { toast.success(`${title} is already saved on this device`); return; }
      toast.success(`Saving ${todo.length} ${todo.length === 1 ? "song" : "songs"} from ${title}`);
      if (playable.length > eligible.length) toast(`${playable.length - eligible.length} need Premium and were skipped.`);
      saveMany(todo.map((x) => ({
        id: x.id, title: x.title, artist: x.artist, coverUrl: x.cover_url || undefined, lyricsLrc: x.lyrics_lrc || undefined,
        durationSeconds: x.duration_seconds || 0, album: x.album || undefined, isFreeDownload: !!x.is_free_download, downloadedAt: Date.now(),
      }))).catch(() => undefined);
    } catch {
      toast.error("Couldn't start saving this album. Check your connection.");
    } finally { setBusy(false); }
  };

  const label = done ? `${title} is saved for offline listening`
    : active ? `Saving ${title} for offline, ${prog!.ready} of ${prog!.total}`
    : `Download ${title} for offline`;

  return (
    <button
      type="button"
      data-offline-ui
      onClick={start}
      aria-label={label}
      title={label}
      className={cn(
        "relative w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-md border border-border/60 bg-background/70 text-foreground",
        "transition-transform duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        done && "bg-offline-accent text-background border-transparent",
        className,
      )}
    >
      {active && (
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 36 36" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`Saving ${title}`}>
          <circle cx="18" cy="18" r="16" fill="none" stroke="hsl(var(--offline-accent))" strokeWidth="2.5" strokeDasharray={`${(pct / 100) * 100.5} 100.5`} strokeLinecap="round" />
        </svg>
      )}
      {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        : done ? <Check className="w-4 h-4" strokeWidth={3} aria-hidden="true" />
        : active ? <span className="text-[10px] font-semibold tabular-nums">{prog!.ready}/{prog!.total}</span>
        : <Download className="w-4 h-4" aria-hidden="true" />}
    </button>
  );
};

export default AlbumSaveButton;
