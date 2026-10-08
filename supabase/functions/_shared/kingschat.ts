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

export type KcPlatform = "web" | "android";

export function normalizePlatform(value: unknown): KcPlatform {
  return value === "android" ? "android" : "web";
}

/**
 * Platform-aware client id lookup.
 * Falls back to the legacy KINGSCHAT_CLIENT_ID secret so existing deployments
 * keep working without any change.
 */
export function getClientId(platform: KcPlatform = "web"): string {
  const legacy = Deno.env.get("KINGSCHAT_CLIENT_ID");
  const name = platform === "android" ? "KINGSCHAT_ANDROID_CLIENT_ID" : "KINGSCHAT_WEB_CLIENT_ID";
  const id = Deno.env.get(name) || (platform === "web" ? legacy : undefined);
  if (!id) {
    throw new Error(
      `${name} is not configured — add it as a secret to enable KingsChat ${platform} sign-in`,
    );
  }
  return id;
}

export interface KcTokens {
  access_token: string;
  refresh_token?: string;
  expires_in_millis?: number;
  expires_in?: number;
}

async function requestTokens(
  body: Record<string, string>,
  platform: KcPlatform,
): Promise<KcTokens> {
  const res = await fetch(KC_TOKEN_URL, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  // Never log tokens — only platform, truncated client id, status and body.
  console.log(
    `KC token ${body.grant_type} platform=${platform} client_id=${body.client_id.slice(0, 8)}… status=${res.status} body=${
      res.ok ? "<ok>" : text.slice(0, 300)
    }`,
  );
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* keep raw */ }
  if (!res.ok || !json?.access_token) {
    throw new Error(`KingsChat token request failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return json as KcTokens;
}

export const exchangeCode = (code: string, platform: KcPlatform = "web") =>
  requestTokens({ grant_type: "code", client_id: getClientId(platform), code }, platform);

export const refreshTokens = (refreshToken: string, platform: KcPlatform = "web") =>
  requestTokens(
    { grant_type: "refresh_token", client_id: getClientId(platform), refresh_token: refreshToken },
    platform,
  );

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

/** Read a protobuf varint at `pos`; returns [value, bytesUsed] or null. */
function readVarint(bytes: Uint8Array, pos: number): [number, number] | null {
  let value = 0, shift = 0, used = 0;
  while (pos + used < bytes.length && used < 5) {
    const b = bytes[pos + used++];
    value += (b & 0x7f) * 2 ** shift;
    if ((b & 0x80) === 0) return [value, used];
    shift += 7;
  }
  return null;
}

const IMAGE_URL = /^https?:\/\/[^\s]+$/i;
const looksLikeAvatar = (s: string) =>
  IMAGE_URL.test(s) && (/\.(webp|jpe?g|png|gif)(\?|$)/i.test(s) || /\/uploads\/|\/media\/|\/avatars?\//i.test(s) || /^https?:\/\/cdn/i.test(s));

export function parseProtobufProfile(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const strings: string[] = [];
  for (let i = 0; i < bytes.length; i++) {
    if ((bytes[i] & 0x07) !== 2) continue;
    const v = readVarint(bytes, i + 1);
    if (!v) continue;
    const [len, used] = v;
    const start = i + 1 + used;
    if (len < 2 || len > 4096 || start + len > bytes.length) continue;
    try {
      const str = decoder.decode(bytes.subarray(start, start + len));
      if (/^[\x20-\x7E\u00A0-\uFFFF]+$/.test(str)) strings.push(str);
    } catch { /* not text */ }
  }
  let userId = "", displayName = "", username = "";
  let avatarUrl: string | null = null;
  for (const s of strings) {
    if (looksLikeAvatar(s)) { if (!avatarUrl || s.length > avatarUrl.length) avatarUrl = s; }
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
