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

if ('serviceWorker' in navigator && !isMedian && import.meta.env.PROD) {
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
}


if ('serviceWorker' in navigator && import.meta.env.DEV) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
  });

  if ('caches' in window) {
    caches.keys().then((keys) => {
      keys
        .filter((key) => key.startsWith('lmk-cache-'))
        .forEach((key) => caches.delete(key));
    });
  }
}
