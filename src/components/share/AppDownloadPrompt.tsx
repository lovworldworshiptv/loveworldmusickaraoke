import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { isMedianApp } from "@/lib/median";

export const APP_DOWNLOAD_URL = "https://web.lwappstore.com/share/lW-APP-Y26-XX5010";
const DISMISS_KEY = "lw_app_prompt_dismissed_at";
const WEEK = 7 * 86400000;

/** Visitors on the website (not inside the installed app) are invited to download the app. */
const AppDownloadPrompt = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isMedianApp()) return;
    if (window.matchMedia?.("(display-mode: standalone)").matches) return;
    if (window.location.pathname.startsWith("/admin")) return;
    try {
      const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
      if (Date.now() - at < WEEK) return;
    } catch { /* ignore */ }
    const t = setTimeout(() => setShow(true), 1500);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
    setShow(false);
  };

  if (!show) return null;
  return (
    <div role="dialog" aria-label="Get the app"
      className="fixed left-3 right-3 top-3 z-[120] mx-auto max-w-md glass-card rounded-2xl p-3 flex items-center gap-3 shadow-lg animate-fade-in-up">
      <div className="w-10 h-10 rounded-xl gradient-gold flex items-center justify-center shrink-0">
        <Download className="w-5 h-5 text-primary-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">Get the Loveworld Music Karaoke+ app</p>
        <p className="text-xs text-muted-foreground">Smoother playback, offline songs and alerts.</p>
      </div>
      <a href={APP_DOWNLOAD_URL} target="_blank" rel="noopener noreferrer" onClick={dismiss}
        className="px-3 py-1.5 rounded-full gradient-gold text-primary-foreground text-xs font-semibold">Download</a>
      <button onClick={dismiss} aria-label="Close" className="p-1 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
    </div>
  );
};

export default AppDownloadPrompt;
