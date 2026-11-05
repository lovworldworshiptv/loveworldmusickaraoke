import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isMedianApp } from "@/lib/median";

const NEW_SESSION_AFTER = 30 * 60 * 1000;

const platform = () => {
  if (isMedianApp()) return /iphone|ipad/i.test(navigator.userAgent) ? "ios" : "android";
  if (window.matchMedia?.("(display-mode: standalone)").matches) return "pwa";
  return "web";
};

/** Counts how long signed-in people have the app open (visible time only) as app sessions. */
const AppSessionTracker = () => {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    let sessionId: string | null = null;
    let since = Date.now();
    let hiddenAt = 0;
    let stopped = false;
    const start = async () => {
      const { data } = await supabase.rpc("start_app_session", { p_platform: platform() });
      if (!stopped) sessionId = (data as string) || null;
      since = Date.now();
    };
    const flush = () => {
      if (!sessionId || document.visibilityState !== "visible") return;
      const secs = Math.round((Date.now() - since) / 1000);
      since = Date.now();
      if (secs >= 1) supabase.rpc("add_session_seconds", { p_session_id: sessionId, p_seconds: secs }).then(() => {}, () => {});
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        const secs = Math.round((Date.now() - since) / 1000);
        if (sessionId && secs >= 1) supabase.rpc("add_session_seconds", { p_session_id: sessionId, p_seconds: secs }).then(() => {}, () => {});
        hiddenAt = Date.now();
      } else {
        if (hiddenAt && Date.now() - hiddenAt > NEW_SESSION_AFTER) start(); else since = Date.now();
      }
    };
    if (document.visibilityState === "visible") start();
    const t = window.setInterval(flush, 60000);
    document.addEventListener("visibilitychange", onVis);
    return () => { flush(); stopped = true; window.clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [user?.id]);
  return null;
};

export default AppSessionTracker;
