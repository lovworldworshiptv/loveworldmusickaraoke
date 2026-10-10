import { useState, useEffect } from "react";

/**
 * Connectivity status. Browser `offline` events are trusted immediately;
 * `online` events are confirmed with a tiny request so flaky Wi-Fi or
 * captive portals don't bounce the app between online and offline.
 */
const probe = async (): Promise<boolean> => {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`/favicon.png?ping=${Date.now()}`, { method: "HEAD", cache: "no-store", signal: ctrl.signal });
    clearTimeout(t);
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
};

export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;

    const confirmOnline = async () => {
      if (await probe()) {
        if (!cancelled) setIsOnline(true);
      } else if (!cancelled && navigator.onLine) {
        retry = setTimeout(confirmOnline, 4000);
      }
    };
    const goOnline = () => { clearTimeout(retry); confirmOnline(); };
    const goOffline = () => { clearTimeout(retry); setIsOnline(false); };

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      cancelled = true;
      clearTimeout(retry);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return isOnline;
};
