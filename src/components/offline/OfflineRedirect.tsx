import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

const DOWNLOADS = "/library?tab=downloads";
const RETURN_KEY = "lmk_offline_return_to";
// Pages that keep working offline and should not be redirected away from.
const OFFLINE_SAFE = ["/library", "/studio", "/stage", "/privacy", "/terms"];

/**
 * YouTube-style offline fallback: when the connection drops, open Downloads
 * so saved songs keep playing; when it returns, automatically refresh data
 * and take the listener back to the page they were on.
 */
const OfflineRedirect = () => {
  const isOnline = useOnlineStatus();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isOnline) {
      const path = location.pathname;
      const safe = OFFLINE_SAFE.some((p) => path === p || path.startsWith(`${p}/`));
      if (!safe) {
        sessionStorage.setItem(RETURN_KEY, path + location.search);
        navigate(DOWNLOADS);
      }
      return;
    }
    // Back online: reload fresh content everywhere.
    queryClient.invalidateQueries();
    const target = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    const onDownloads = location.pathname === "/library" && location.search.includes("tab=downloads");
    if (target && onDownloads) {
      navigate(target, { replace: true });
      toast.success("Back online — picking up where you left off");
    }
    // Only react to connectivity changes, not every navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  return null;
};

export default OfflineRedirect;
