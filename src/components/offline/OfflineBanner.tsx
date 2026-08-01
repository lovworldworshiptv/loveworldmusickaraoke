import { useEffect, useState } from "react";
import { CloudOff, RefreshCw, Wifi } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { cn } from "@/lib/utils";

/**
 * Global offline indicator. Explains that browsing continues from the
 * locally cached song / album / playlist metadata and lyrics.
 */
const OfflineBanner = () => {
  const isOnline = useOnlineStatus();
  const [showBackOnline, setShowBackOnline] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
      return;
    }
    if (wasOffline) {
      setShowBackOnline(true);
      const timer = setTimeout(() => {
        setShowBackOnline(false);
        setWasOffline(false);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  if (isOnline && !showBackOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed inset-x-0 top-0 z-[100] px-3 pt-[env(safe-area-inset-top)]"
      )}
    >
      <div
        className={cn(
          "mx-auto mt-2 flex max-w-md items-center gap-3 rounded-2xl border px-4 py-2.5 shadow-lg backdrop-blur-xl",
          isOnline
            ? "border-primary/40 bg-primary/15 text-primary"
            : "border-border/60 bg-card/90 text-foreground"
        )}
      >
        {isOnline ? (
          <Wifi className="h-4 w-4 shrink-0" />
        ) : (
          <CloudOff className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">
            {isOnline ? "Back online" : "You're offline"}
          </p>
          {!isOnline && (
            <p className="truncate text-xs text-muted-foreground">
              Browsing saved songs, albums &amp; lyrics
            </p>
          )}
        </div>
        {!isOnline && (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        )}
      </div>
    </div>
  );
};

export default OfflineBanner;
