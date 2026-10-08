import { supabase } from "@/integrations/supabase/client";

export type ShareChannel = "kingschat" | "whatsapp" | "x" | "facebook" | "email" | "native" | "copy";
export const CHANNEL_LABELS: Record<string, string> = {
  kingschat: "KingsChat", whatsapp: "WhatsApp", x: "X", facebook: "Facebook",
  email: "Email", native: "Phone share", copy: "Copied link", direct: "Direct / unknown",
};

const SRC_KEY = "lw_share_source";
const VISIT_KEY = "lw_share_visit_logged";

/** Tag a shared link with its channel so new visitors can be attributed. */
export const tagShareUrl = (url: string, channel: ShareChannel) => {
  try { const u = new URL(url); u.searchParams.set("src", channel); return u.toString(); } catch { return url; }
};

const log = async (event_type: string, event_data: Record<string, unknown>) => {
  try {
    const { data: s } = await supabase.auth.getSession();
    await supabase.from("analytics_events").insert({ event_type, user_id: s.session?.user.id ?? null, event_data: event_data as any });
  } catch { /* analytics must never block the user */ }
};

const platform = () => {
  const ua = navigator.userAgent;
  return /android/i.test(ua) ? "android" : /iphone|ipad|ipod/i.test(ua) ? "ios" : "web";
};

export const logShareClick = (channel: ShareChannel, url: string) => {
  let path = url; try { path = new URL(url).pathname; } catch { /* keep */ }
  const content = path.startsWith("/auth") ? "invite" : path.startsWith("/articles") ? "article" : path.startsWith("/library") ? "song" : "page";
  log("share_click", { channel, content, path });
};

export const logAppDownloadClick = (surface: string) =>
  log("app_download_click", { surface, platform: platform(), source: getShareSource() });

/** Remember which channel brought this visitor (from ?src=) and log the visit once. */
export const captureShareSource = () => {
  try {
    const src = new URLSearchParams(window.location.search).get("src");
    if (!src || !(src in CHANNEL_LABELS)) return;
    localStorage.setItem(SRC_KEY, src);
    if (!sessionStorage.getItem(VISIT_KEY)) {
      sessionStorage.setItem(VISIT_KEY, "1");
      log("share_visit", { channel: src, path: window.location.pathname });
    }
  } catch { /* storage unavailable */ }
};

export const getShareSource = () => { try { return localStorage.getItem(SRC_KEY) || "direct"; } catch { return "direct"; } };

export const logReferralSignup = (code: string) => log("referral_signup", { channel: getShareSource(), invite: code.slice(0, 80) });
