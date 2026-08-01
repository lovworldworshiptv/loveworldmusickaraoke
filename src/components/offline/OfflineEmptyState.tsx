import { CloudOff, RefreshCw } from "lucide-react";

interface OfflineEmptyStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

/**
 * Fallback shown when a list has no cached data available offline.
 */
const OfflineEmptyState = ({
  title = "Nothing saved for offline",
  message = "You're offline and this content hasn't been cached yet. Reconnect to load it, then it stays available offline.",
  onRetry,
}: OfflineEmptyStateProps) => (
  <div className="flex flex-col items-center justify-center rounded-2xl border border-border/60 bg-card/60 px-6 py-10 text-center backdrop-blur-xl">
    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50">
      <CloudOff className="h-6 w-6 text-muted-foreground" />
    </div>
    <h3 className="text-base font-semibold text-foreground">{title}</h3>
    <p className="mt-2 max-w-sm text-sm text-muted-foreground">{message}</p>
    <button
      type="button"
      onClick={onRetry ?? (() => window.location.reload())}
      className="mt-5 flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
    >
      <RefreshCw className="h-4 w-4" />
      Try again
    </button>
  </div>
);

export default OfflineEmptyState;
