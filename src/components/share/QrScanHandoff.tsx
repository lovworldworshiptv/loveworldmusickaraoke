import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { isMedianApp } from "@/lib/median";
import { qrHandoff } from "@/lib/qrHandoff";
import { APP_DOWNLOAD_URL } from "@/components/share/AppDownloadPrompt";
import { logAppDownloadClick } from "@/lib/acquisitionAnalytics";

const DONE_KEY = "lw_qr_handoff_done";
export const QR_SHEET_EVENT = "lw-qr-sheet";

/** Someone scanned a share card without the app: Android opens the app (or Play Store); others see a sheet. */
const QrScanHandoff = () => {
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia?.("(display-mode: standalone)").matches;
    const h = qrHandoff(window.location.pathname, window.location.search, navigator.userAgent, isMedianApp() || !!standalone);
    if (!h) return;
    // Only once per link, so coming back from the Play Store doesn't bounce again.
    const key = window.location.pathname + window.location.search;
    try { if (sessionStorage.getItem(DONE_KEY) === key) return; sessionStorage.setItem(DONE_KEY, key); } catch { /* ignore */ }
    if (h.kind === "intent") window.location.href = h.url;
    else { setSheet(true); window.dispatchEvent(new Event(QR_SHEET_EVENT)); }
  }, []);

  if (!sheet) return null;
  return (
    <div className="fixed inset-0 z-[140] flex items-end justify-center bg-background/70 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Get the app">
      <div className="w-full max-w-md glass-card rounded-t-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-4">
        <div className="mx-auto h-1.5 w-10 rounded-full bg-muted" aria-hidden />
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl gradient-gold flex items-center justify-center shrink-0">
            <Download className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Get the Loveworld Music+ app</p>
            <p className="text-sm text-muted-foreground">Open this song in the app for smoother playback and offline listening.</p>
          </div>
        </div>
        <a href={APP_DOWNLOAD_URL} target="_blank" rel="noopener noreferrer" onClick={() => logAppDownloadClick("qr_sheet")}
          className="block w-full text-center rounded-full gradient-gold py-3 font-semibold text-primary-foreground">Get the app</a>
        <button onClick={() => setSheet(false)} className="block w-full text-center rounded-full border border-border py-3 font-medium text-foreground">Continue on website</button>
      </div>
    </div>
  );
};

export default QrScanHandoff;
