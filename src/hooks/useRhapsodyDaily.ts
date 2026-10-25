import { useCallback, useEffect, useRef, useState } from "react";
import { fetchRhapsodyDaily, readCachedDevotional, type RhapsodyDevotional } from "@/lib/rhapsodyDaily";

const REFRESH_ON_RETURN_MS = 10 * 60 * 1000; // when the app comes back to screen
const REFRESH_WHILE_OPEN_MS = 30 * 60 * 1000; // while the page stays visible

/** Shows the last saved devotional instantly, then refreshes so a new day's article appears as soon as it is published. */
export function useRhapsodyDaily() {
  const [devotional, setDevotional] = useState<RhapsodyDevotional | null>(() => readCachedDevotional());
  const [loading, setLoading] = useState(true);
  const lastFetch = useRef(0);

  const refresh = useCallback(async () => {
    lastFetch.current = Date.now();
    const next = await fetchRhapsodyDaily();
    if (next) setDevotional(prev => (prev && prev.id === next.id && prev.date === next.date ? prev : next));
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastFetch.current > REFRESH_ON_RETURN_MS) refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, REFRESH_WHILE_OPEN_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [refresh]);

  return { devotional, loading };
}
