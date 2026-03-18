import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations
          .filter((registration) => registration.active?.scriptURL.includes("/serviceworker.js"))
          .map((registration) => registration.unregister())
      );

      if ("caches" in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(
          cacheKeys
            .filter((key) => key.startsWith("lmk-cache-"))
            .map((key) => caches.delete(key))
        );
      }

      await navigator.serviceWorker.register("/serviceworker.js");
    } catch (error) {
      console.error("[ServiceWorker] Registration recovery failed", error);
    }
  });
}
