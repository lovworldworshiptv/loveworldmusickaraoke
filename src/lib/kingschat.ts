import { supabase } from "@/integrations/supabase/client";

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// NOTE: the KingsChat client_id lives ONLY in the backend (KINGSCHAT_CLIENT_ID
// secret). The frontend only ever talks to our own edge functions.

const safePath = (value: string | null | undefined) =>
  value && value.startsWith("/") && !value.startsWith("//") ? value : "/";

/** Full-page redirect into the KingsChat hosted login page. */
export function startKingsChatLogin(next = "/") {
  window.location.href = `${FUNCTIONS_BASE}/kingschat-login?next=${encodeURIComponent(safePath(next))}`;
}

interface LoginStart { url: string; origin: string; redirect_path: string }

async function createLoginAttempt(next: string): Promise<LoginStart> {
  const res = await fetch(
    `${FUNCTIONS_BASE}/kingschat-login?format=json&next=${encodeURIComponent(safePath(next))}`,
    { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } },
  );
  const json = await res.json();
  if (!res.ok || !json?.url) throw new Error(json?.error || "Could not start KingsChat sign-in");
  return json as LoginStart;
}

async function poll(origin: string) {
  const res = await fetch(`${FUNCTIONS_BASE}/kingschat-poll?nonce=${encodeURIComponent(origin)}`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
  });
  return res.json();
}

export interface KingsChatLoginResult {
  redirectPath: string;
  username?: string;
}

/**
 * Popup sign-in: opens the KingsChat login page, then waits for the
 * server-to-server callback to stage the app session and applies it.
 */
export async function signInWithKingsChat(next = "/"): Promise<KingsChatLoginResult> {
  const popup = window.open("", "kingschat-login", "width=480,height=720");
  if (!popup) throw new Error("Popup blocked — please allow popups and try again");

  let start: LoginStart;
  try {
    start = await createLoginAttempt(next);
  } catch (e) {
    popup.close();
    throw e;
  }
  popup.location.href = start.url;

  const deadline = Date.now() + 5 * 60 * 1000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    let result: any;
    try {
      result = await poll(start.origin);
    } catch {
      continue;
    }

    if (result?.status === "ready" && result?.session) {
      try { popup.close(); } catch { /* ignore */ }
      const { error } = await supabase.auth.setSession({
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
      });
      if (error) throw error;
      return {
        redirectPath: safePath(result.redirect_path || start.redirect_path),
        username: result.kingschat_profile?.username,
      };
    }
    if (result?.status === "error") {
      try { popup.close(); } catch { /* ignore */ }
      throw new Error(result.error || "KingsChat sign-in failed");
    }
    if (result?.status === "expired") {
      try { popup.close(); } catch { /* ignore */ }
      throw new Error("KingsChat sign-in expired, please try again");
    }
    if (popup.closed && Date.now() > deadline - 4.5 * 60 * 1000) {
      // popup closed by user before completing
    }
  }

  try { popup.close(); } catch { /* ignore */ }
  throw new Error("KingsChat sign-in timed out");
}

/** Ensures the stored KingsChat access token is still valid (refreshes if not). */
export async function ensureKingsChatToken() {
  const { data, error } = await supabase.functions.invoke("kingschat-refresh", { method: "POST" });
  if (error) throw error;
  return data as { refreshed: boolean; expires_at: string };
}
