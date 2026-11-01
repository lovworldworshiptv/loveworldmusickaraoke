import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { APP_UPDATE_KEY, UPDATED_STORAGE_KEY, shouldShowUpdate, type AppUpdateNotice } from "@/lib/appUpdate";

const readUpdated = () => { try { return localStorage.getItem(UPDATED_STORAGE_KEY); } catch { return null; } };

/** Full-screen prompt asking everyone to update; hidden for good once they tap Update. */
const AppUpdatePrompt = () => {
  const [notice, setNotice] = useState<AppUpdateNotice | null>(null);
  const [later, setLater] = useState(false);

  useEffect(() => {
    if (window.location.pathname.startsWith("/admin")) return;
    const load = async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", APP_UPDATE_KEY).maybeSingle();
      setNotice((data?.value as AppUpdateNotice) ?? null);
    };
    load();
    const id = setInterval(load, 10 * 60 * 1000);
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, []);

  if (later || !shouldShowUpdate(notice, readUpdated()) || !notice) return null;

  const update = async () => {
    try { localStorage.setItem(UPDATED_STORAGE_KEY, notice.version!.trim()); } catch { /* ignore */ }
    const url = notice.url?.trim();
    if (url && /^https?:\/\//i.test(url)) {
      window.open(url, "_blank", "noopener,noreferrer");
      setLater(true);
      return;
    }
    try {
      const regs = await navigator.serviceWorker?.getRegistrations?.();
      await Promise.all((regs || []).map((r) => r.update().catch(() => undefined)));
      const keys = await caches?.keys?.();
      await Promise.all((keys || []).map((k) => caches.delete(k)));
    } catch { /* ignore */ }
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-fade-in-up">
      <div role="alertdialog" aria-modal="true" aria-labelledby="update-title" aria-describedby="update-msg"
        className="glass-card w-full max-w-sm rounded-3xl p-6 text-center shadow-lg">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl gradient-gold">
          <RefreshCw className="h-7 w-7 text-primary-foreground" />
        </div>
        <h2 id="update-title" className="text-lg font-bold text-foreground">{notice.title || "A new update is available"}</h2>
        <p id="update-msg" className="mt-2 text-sm text-muted-foreground whitespace-pre-line">
          {notice.message || "Update Loveworld Music+ to get the latest features and fixes."}
        </p>
        <button onClick={update} autoFocus
          className="mt-5 w-full rounded-full gradient-gold py-3 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {notice.buttonLabel || "Update now"}
        </button>
        <button onClick={() => setLater(true)} className="mt-2 w-full py-2 text-xs text-muted-foreground hover:text-foreground">
          Later
        </button>
      </div>
    </div>
  );
};

export default AppUpdatePrompt;
