import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Skip custom service worker inside Median native wrapper —
// Median manages its own push / SW infrastructure.
const isMedian = typeof (window as any).median !== 'undefined'
  || navigator.userAgent.includes('median')
  || navigator.userAgent.includes('gonative');

if ('serviceWorker' in navigator && !isMedian) {
  navigator.serviceWorker.register('/serviceworker.js');
}
