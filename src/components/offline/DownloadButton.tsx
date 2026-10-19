import { useRef, useState } from "react";
import { Download, Pause, Check, Lock } from "lucide-react";
import { useSongDownload } from "@/hooks/useSecureDownloads";
import { pauseItem, retry } from "@/lib/secureDownloads/engine";
import { downloadUiState } from "@/lib/secureDownloads/policy";
import { cn } from "@/lib/utils";

interface Props {
  songId: string;
  title: string;
  /** Start saving (the caller handles sign-in / Premium checks and the upgrade prompt). */
  onDownload: () => void;
  /** Saved by an older copy that isn't in the new queue yet. */
  saved?: boolean;
  /** Paid song and the listener isn't Premium: show a lock instead of the arrow. */
  needsPremium?: boolean;
  size?: "sm" | "md";
  className?: string;
}

const RING = 2 * Math.PI * 9;

/**
 * One download control for songs everywhere: idle → queued (soft pulse) → saving (progress ring,
 * percentage on hover/long-press) → paused → saved (check with a short spring) or error (amber dot, tap to retry).
 */
const DownloadButton = ({ songId, title, onDownload, saved, needsPremium, size = "sm", className }: Props) => {
  const { status, active, pct, waitingWifi } = useSongDownload(songId);
  const state = saved && !status ? "done" : downloadUiState(status, active);
  const [showPct, setShowPct] = useState(false);
  const hold = useRef<number | null>(null);
  const longPressed = useRef(false);
  const icon = size === "md" ? "w-5 h-5" : "w-4 h-4";
  const box = size === "md" ? "w-11 h-11" : "w-10 h-10";

  if (state === "done") {
    return (
      <span data-offline-ui role="img" aria-label={`${title} is saved for offline listening`} className={cn("inline-flex items-center justify-center shrink-0", box, className)}>
        <span className="w-6 h-6 rounded-full bg-offline-accent text-background flex items-center justify-center motion-safe:animate-download-done">
          <Check className="w-3.5 h-3.5" strokeWidth={3} aria-hidden="true" />
        </span>
      </span>
    );
  }

  const label =
    state === "downloading" ? `Saving ${title} for offline, ${pct}%. Tap to pause`
    : state === "queued" ? (waitingWifi ? `${title} is waiting for Wi-Fi. Tap to pause` : `${title} is waiting to save. Tap to pause`)
    : state === "paused" ? `Saving ${title} is paused. Tap to continue`
    : state === "error" ? `Couldn't save ${title}. Try again`
    : state === "locked" || needsPremium ? `Download ${title} for offline — Premium`
    : `Download ${title} for offline`;

  const onClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (longPressed.current) { longPressed.current = false; return; }
    if (state === "downloading" || state === "queued") pauseItem(songId);
    else if (state === "paused" || state === "error") retry(songId);
    else onDownload();
  };
  const startHold = () => {
    if (state !== "downloading") return;
    hold.current = window.setTimeout(() => {
      longPressed.current = true;
      setShowPct(true);
      window.setTimeout(() => setShowPct(false), 1500);
    }, 450);
  };
  const endHold = () => { if (hold.current) { clearTimeout(hold.current); hold.current = null; } };

  return (
    <span data-offline-ui className={cn("relative inline-flex shrink-0 group", className)}>
      <button
        type="button"
        onClick={onClick}
        onPointerDown={startHold}
        onPointerUp={endHold}
        onPointerLeave={endHold}
        onContextMenu={(e) => { if (state === "downloading") e.preventDefault(); }}
        aria-label={label}
        title={state === "downloading" ? `${pct}%` : undefined}
        className={cn(
          "relative inline-flex items-center justify-center rounded-full transition-colors duration-200 ease-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "text-muted-foreground hover:text-foreground hover:bg-muted/60",
          (state === "downloading" || state === "queued" || state === "paused") && "text-offline-accent hover:text-offline-accent",
          box,
        )}
      >
        {state === "downloading" ? (
          <>
            <svg viewBox="0 0 24 24" className={cn("absolute -rotate-90", size === "md" ? "w-8 h-8" : "w-7 h-7")} aria-hidden="true">
              <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
              <circle
                cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                strokeDasharray={RING} strokeDashoffset={RING * (1 - pct / 100)}
                className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-200 motion-safe:ease-out"
              />
            </svg>
            <span className="w-1.5 h-1.5 rounded-sm bg-current" aria-hidden="true" />
          </>
        ) : state === "paused" ? (
          <Pause className={icon} aria-hidden="true" />
        ) : state === "locked" || (state === "idle" && needsPremium) ? (
          <Lock className={cn(icon, "text-offline-accent")} aria-hidden="true" />
        ) : (
          <Download className={cn(icon, state === "queued" && "motion-safe:animate-pulse")} aria-hidden="true" />
        )}
        {state === "error" && (
          <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-offline-warning ring-2 ring-background" aria-hidden="true" />
        )}
      </button>
      {state === "downloading" && (
        <>
          <span
            role="progressbar"
            aria-label={`Saving ${title}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            className="sr-only"
          />
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 rounded-full bg-popover text-popover-foreground border border-border px-2 py-0.5 text-[11px] font-semibold tabular-nums shadow-md",
              "opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100",
              showPct && "opacity-100",
            )}
          >
            {pct}%
          </span>
        </>
      )}
    </span>
  );
};

export default DownloadButton;
