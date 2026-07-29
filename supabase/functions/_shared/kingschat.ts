// Shared KingsChat OAuth2 helpers (authorization code flow, server-to-server).
// client_id is ONLY read from the server-side environment. Never expose it to the frontend.

export const KC_LOGIN_URL = "https://accounts.kingschat.online/log-in";
export const KC_TOKEN_URL = "https://connect.kingsch.at/developer/api/oauth2/token";
export const KC_API = "https://connect.kingsch.at";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export function getClientId(): string {
  const id = Deno.env.get("KINGSCHAT_CLIENT_ID");
  if (!id) throw new Error("KINGSCHAT_CLIENT_ID is not configured");
  return id;
}

export interface KcTokens {
  access_token: string;
  refresh_token?: string;
  expires_in_millis?: number;
  expires_in?: number;
}

async function requestTokens(body: Record<string, string>): Promise<KcTokens> {
  const res = await fetch(KC_TOKEN_URL, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* keep raw */ }
  if (!res.ok || !json?.access_token) {
    throw new Error(`KingsChat token request failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return json as KcTokens;
}

export const exchangeCode = (code: string) =>
  requestTokens({ grant_type: "code", client_id: getClientId(), code });

export const refreshTokens = (refreshToken: string) =>
  requestTokens({ grant_type: "refresh_token", client_id: getClientId(), refresh_token: refreshToken });

export function expiryFromTokens(tokens: KcTokens): string {
  const ms = tokens.expires_in_millis ?? (tokens.expires_in ? tokens.expires_in * 1000 : 3600_000);
  return new Date(Date.now() + ms).toISOString();
}

export function decodeJwtPayload(token: string): any | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    return JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

/** `origin`/`next` values are untrusted: only ever allow same-app relative paths. */
export function safeInternalPath(value: unknown): string {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

function parseProtobufProfile(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const strings: string[] = [];
  let i = 0;
  while (i < bytes.length) {
    const tag = bytes[i];
    if ((tag & 0x07) === 2 && i + 1 < bytes.length) {
      const len = bytes[i + 1];
      if (len > 0 && len < 255 && i + 2 + len <= bytes.length) {
        try {
          const str = new TextDecoder().decode(bytes.slice(i + 2, i + 2 + len));
          if (str.length > 1 && /^[\x20-\x7E\u00A0-\uFFFF]+$/.test(str)) strings.push(str);
        } catch { /* skip */ }
      }
    }
    i++;
  }
  let userId = "", displayName = "", username = "";
  let avatarUrl: string | null = null;
  for (const s of strings) {
    if (/^https?:\/\/cdn/.test(s)) avatarUrl = s;
    else if (/^[a-f0-9]{24}$/.test(s)) userId = s;
    else if (!displayName && s.length > 2 && s.includes(" ") && !s.includes("|") && !s.includes("/")) displayName = s;
    else if (!username && /^[a-zA-Z0-9_]{2,30}$/.test(s) && s !== userId) username = s;
  }
  return { userId, displayName, username, avatarUrl };
}

export async function fetchKcProfile(accessToken: string, kcUserId: string) {
  try {
    const res = await fetch(`${KC_API}/api/users/${kcUserId}`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "*/*" },
    });
    if (res.ok) return parseProtobufProfile(await res.arrayBuffer());
  } catch (e) {
    console.log("KC profile fetch error:", (e as Error).message);
  }
  return null;
}
