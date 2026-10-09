import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

const DOWNLOADS = "/library?tab=downloads";
// Pages that keep working offline and should not be redirected away from.
const OFFLINE_SAFE = ["/library", "/studio", "/stage", "/privacy", "/terms", "/auth"];

/**
 * YouTube-style offline fallback: when the connection drops, open the
 * Downloads screen so saved songs keep playing; when it returns, offer
 * a one-tap way back to the page the listener was on.
 */
const OfflineRedirect = () => {
  const isOnline = useOnlineStatus();
  const location = useLocation();
  const navigate = useNavigate();
  const returnTo = useRef<string | null>(null);

  useEffect(() => {
    if (!isOnline) {
      const path = location.pathname;
      const safe = OFFLINE_SAFE.some((p) => path === p || path.startsWith(`${p}/`));
      const onDownloads = path === "/library" && location.search.includes("tab=downloads");
      if (!safe && !onDownloads) {
        returnTo.current = path + location.search;
        navigate(DOWNLOADS, { replace: false });
      }
      return;
    }
    if (returnTo.current) {
      const target = returnTo.current;
      returnTo.current = null;
      toast.success("You're back online", {
        action: { label: "Go back", onClick: () => navigate(target) },
        duration: 8000,
      });
    }
    // Only react to connectivity changes, not every navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  return null;
};

export default OfflineRedirect;
