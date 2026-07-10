import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Skip custom service worker inside Median native wrapper —
// Median manages its own push / SW infrastructure.
const ua = navigator.userAgent.toLowerCase();
const isMedian = typeof (window as any).median !== 'undefined'
  || ua.includes('median')
  || ua.includes('gonative');

if ('serviceWorker' in navigator && !isMedian) {
  if (import.meta.env.PROD) {
    navigator.serviceWorker.register('/serviceworker.js');
  } else {
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
}
