import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Check, Pause, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { useIsPremium } from "@/hooks/useIsPremium";
import { canUseSong, isFreeSong, useFreeSongIds } from "@/lib/freeSongs";
import { useSecureDownloads } from "@/hooks/useSecureDownloads";
import { saveMany } from "@/lib/downloadManager";
import { pauseItem, retry } from "@/lib/secureDownloads/engine";
import { bulkProgress } from "@/lib/secureDownloads/policy";
import { cn } from "@/lib/utils";
import type { PlayerSong } from "@/contexts/PlayerContext";

type BulkSong = PlayerSong & { isFreeDownload?: boolean | null };

interface Props {
  songs: BulkSong[];
  /** e.g. "album" or "playlist" — used in labels. */
  what?: string;
  className?: string;
}

/** Album / playlist / collection "Download all" with an overall progress bar and an item counter. */
const DownloadAllButton = ({ songs, what = "list", className }: Props) => {
  const { user } = useAuth();
  const { isPremium } = useIsPremium();
  const freeIds = useFreeSongIds();
  const navigate = useNavigate();
  const s = useSecureDownloads();
  const [starting, setStarting] = useState(false);

  const eligible = useMemo(() => songs.filter((x) => x.audioUrl && canUseSong(isPremium, x, freeIds)), [songs, isPremium, freeIds]);
  const ids = useMemo(() => eligible.map((x) => x.id), [eligible]);
  const byId = useMemo(() => new Map(s.items.map((i) => [i.songId, i])), [s.items]);
  const prog = bulkProgress(ids, (id) => byId.get(id)?.status, (id) => s.progress[id]);
  const active = prog.pending > 0;
  const allPaused = active && ids.every((id) => { const st = byId.get(id)?.status; return !st || st === "ready" || st === "paused" || st === "failed" || st === "locked"; });
  const lockedCount = songs.filter((x) => x.audioUrl).length - eligible.length;

  if (!songs.some((x) => x.audioUrl)) return null;

  const start = async () => {
    if (!user) { navigate("/auth"); return; }
    if (!eligible.length) { toast("Premium lets you save whole albums and playlists for offline listening."); navigate("/subscription"); return; }
    const todo = eligible.filter((x) => byId.get(x.id)?.status !== "ready");
    setStarting(true);
    const run = saveMany(todo.map((x) => ({
      id: x.id, title: x.title, artist: x.artist, coverUrl: x.coverUrl, lyricsLrc: x.lyricsLrc,
      durationSeconds: x.durationSeconds || 0, album: x.album, isFreeDownload: isFreeSong(x, freeIds), downloadedAt: Date.now(),
    })));
    setStarting(false);
    toast.success(`Saving ${todo.length} ${todo.length === 1 ? "song" : "songs"} for offline listening`);
    if (lockedCount > 0) toast(`${lockedCount} ${lockedCount === 1 ? "song needs" : "songs need"} Premium and ${lockedCount === 1 ? "was" : "were"} skipped.`);
    const r = await run.catch(() => null);
    if (r && r.failed === 0 && r.saved > 0) toast.success(`All ${r.saved} songs are ready offline`);
  };

  const togglePause = () => {
    for (const id of ids) {
      const st = byId.get(id)?.status;
      if (allPaused) { if (st === "paused" || st === "failed") retry(id); }
      else if (st === "queued" || st === "preparing" || st === "downloading") pauseItem(id);
    }
  };

  if (prog.complete) {
    return (
      <span data-offline-ui className={cn("inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground", className)} role="status">
        <span className="w-4 h-4 rounded-full bg-offline-accent text-background flex items-center justify-center motion-safe:animate-download-done"><Check className="w-3 h-3" strokeWidth={3} aria-hidden="true" /></span>
        All {prog.total} saved
      </span>
    );
  }

  if (active) {
    return (
      <div data-offline-ui className={cn("flex items-center gap-2 min-w-[11rem] rounded-full border border-border bg-card/60 pl-3 pr-1 py-1", className)}>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-foreground tabular-nums" aria-live="polite">
            {allPaused ? "Paused · " : "Saving "}{prog.ready} of {prog.total}
          </p>
          <Progress value={prog.percent} className="h-1 mt-1" aria-label={`Saving this ${what} for offline`} aria-valuenow={prog.percent} aria-valuemin={0} aria-valuemax={100} />
        </div>
        <button
          type="button"
          onClick={togglePause}
          aria-label={allPaused ? `Continue saving this ${what}` : `Pause saving this ${what}`}
          className="w-9 h-9 rounded-full flex items-center justify-center text-offline-accent hover:bg-muted/60 transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {allPaused ? <Play className="w-4 h-4" aria-hidden="true" /> : <Pause className="w-4 h-4" aria-hidden="true" />}
        </button>
      </div>
    );
  }

  const remaining = eligible.filter((x) => byId.get(x.id)?.status !== "ready").length;
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={start}
      disabled={starting}
      className={cn("gap-1.5 rounded-full", className)}
      aria-label={`Download all ${remaining || songs.length} songs in this ${what} for offline`}
    >
      <Download className="w-4 h-4" aria-hidden="true" />
      Download all{prog.failed > 0 ? " · retry" : ""}
    </Button>
  );
};

export default DownloadAllButton;
