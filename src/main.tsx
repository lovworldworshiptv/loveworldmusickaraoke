import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { getSetting, applyTheme, SETTING_KEYS, type ThemeColors } from "./lib/siteSettings";

getSetting<ThemeColors>(SETTING_KEYS.theme).then(applyTheme).catch(() => undefined);

createRoot(document.getElementById("root")!).render(<App />);

// Skip custom service worker inside Median native wrapper —
// Median manages its own push / SW infrastructure.
const ua = navigator.userAgent.toLowerCase();
const isMedian = typeof (window as any).median !== 'undefined'
  || ua.includes('median')
  || ua.includes('gonative');

const host = window.location.hostname;
let inIframe = false;
try { inIframe = window.self !== window.top; } catch { inIframe = true; }
const isPreviewHost =
  host.startsWith('id-preview--') || host.startsWith('preview--') ||
  host === 'lovableproject.com' || host.endsWith('.lovableproject.com') ||
  host === 'lovableproject-dev.com' || host.endsWith('.lovableproject-dev.com') ||
  host === 'beta.lovable.dev' || host.endsWith('.beta.lovable.dev');
const swOff = new URLSearchParams(window.location.search).get('sw') === 'off';
const allowSW = import.meta.env.PROD && !isMedian && !inIframe && !isPreviewHost && !swOff;

if ('serviceWorker' in navigator && allowSW) {
  navigator.serviceWorker.register('/serviceworker.js').then((registration) => {
    // Pull in a new worker version as soon as one is published.
    registration.update().catch(() => undefined);
    // Ask the active worker to drop expired lyrics/metadata on each app start.
    navigator.serviceWorker.ready.then((ready) => {
      ready.active?.postMessage({ type: 'LMK_PRUNE_METADATA_CACHE' });
    });
  }).catch(() => undefined);

  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'LMK_SW_ACTIVATED') {
      console.info('[SW] active cache version:', event.data.version);
    }
  });
} else if ('serviceWorker' in navigator) {
  // Preview/dev/opt-out: remove the app worker so stale files are never served.
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations
      .filter((r) => r.active?.scriptURL.endsWith('/serviceworker.js'))
      .forEach((r) => r.unregister());
  });
}
