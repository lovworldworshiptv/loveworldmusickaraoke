// OneSignal push for both apps: the website (web push) and the Android app (com.loveworld.worship)
// are separate OneSignal apps, each with its own REST API key. Every push and tag update goes to
// both; an app whose key isn't configured is skipped, so the website keeps working on its own.
//
// Secrets: ONESIGNAL_APP_ID + ONESIGNAL_REST_API_KEY (website),
//          ONESIGNAL_ANDROID_REST_API_KEY (+ optional ONESIGNAL_ANDROID_APP_ID) for Android.
//
// Keys: OneSignal's current App API keys ("os_v2_app_…") must be sent as "Authorization: Key …";
// older REST keys use "Basic …". We send the scheme matching the key and fall back to the other
// one on an auth refusal, so either kind of key works.

export type OneSignalPlatform = "web" | "android";

export interface OneSignalApp {
  platform: OneSignalPlatform;
  appId: string;
  apiKey: string;
}

const ANDROID_APP_ID = "171a3c44-9d0e-4177-aa1b-26d8073b6f2f";
const API_BASE = "https://api.onesignal.com";

/** Strips whitespace, quotes and any pasted "Basic "/"Key " prefix from a stored secret. */
function cleanKey(raw: string | undefined): string {
  return (raw ?? "").trim().replace(/^["']|["']$/g, "").replace(/^(Basic|Key|Bearer)\s+/i, "").trim();
}

/**
 * Current App API keys ("os_v2_app_<26 base32 chars>…") carry their own app id. Reading it from
 * the key means a key is always used with its own app, whatever app id is configured.
 */
export function appIdFromKey(key: string): string | null {
  if (!key.startsWith("os_v2_app_")) return null;
  const alpha = "abcdefghijklmnopqrstuvwxyz234567";
  let bits = 0, val = 0;
  const out: number[] = [];
  for (const ch of key.slice(10, 36).toLowerCase()) {
    const i = alpha.indexOf(ch);
    if (i < 0) return null;
    val = ((val << 5) | i) & 0xffff;
    bits += 5;
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; }
  }
  if (out.length < 16) return null;
  const h = out.slice(0, 16).map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

export function oneSignalApps(): OneSignalApp[] {
  const apps: OneSignalApp[] = [];
  const webKey = cleanKey(Deno.env.get("ONESIGNAL_REST_API_KEY"));
  const webId = appIdFromKey(webKey) || (Deno.env.get("ONESIGNAL_APP_ID") ?? "").trim();
  if (webId && webKey) apps.push({ platform: "web", appId: webId, apiKey: webKey });
  const androidKey = cleanKey(Deno.env.get("ONESIGNAL_ANDROID_REST_API_KEY"));
  const androidId = appIdFromKey(androidKey) || (Deno.env.get("ONESIGNAL_ANDROID_APP_ID") ?? "").trim() || ANDROID_APP_ID;
  if (androidKey && androidId !== webId) apps.push({ platform: "android", appId: androidId, apiKey: androidKey });
  return apps;
}

// Remembers which auth scheme each key accepted, for the life of this function instance.
const workingScheme = new Map<string, "Key" | "Basic">();

/** Calls the OneSignal API, trying the right auth scheme for the key and falling back once. */
async function oneSignalFetch(app: OneSignalApp, path: string, method: string, body: unknown): Promise<Response> {
  const preferred = workingScheme.get(app.apiKey) ?? (app.apiKey.startsWith("os_v2_") ? "Key" : "Basic");
  const schemes: ("Key" | "Basic")[] = preferred === "Key" ? ["Key", "Basic"] : ["Basic", "Key"];
  let last: Response | null = null;
  for (const scheme of schemes) {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `${scheme} ${app.apiKey}` },
      body: JSON.stringify(body),
    });
    if (res.status !== 401 && res.status !== 403) {
      workingScheme.set(app.apiKey, scheme);
      return res;
    }
    last = res;
  }
  return last!;
}

export interface PushContent {
  title: string;
  message: string;
  image_url?: string | null;
  /** In-app path such as "/albums". Web opens it as a URL; Android opens the matching screen. */
  deep_link?: string | null;
  /** External https link to open when tapped. */
  action_url?: string | null;
  send_after?: string | null;
  /** Targeting: external user ids (our user ids) … */
  external_user_ids?: string[];
  /** … or segments/filters for broadcasts. */
  included_segments?: string[];
  filters?: unknown[];
}

export interface PushResult {
  success: boolean;
  /** Notification id of the first app that accepted it (kept for notifications.onesignal_id). */
  id: string | null;
  results: { platform: OneSignalPlatform; ok: boolean; id: string | null; errors: unknown }[];
}

// The Loveworld Music+ app logo, shown as the notification's picture instead of the default bell.
const BRAND_ICON = "https://loveworldmusickaraoke.com/icon-512.png";

function payloadFor(app: OneSignalApp, c: PushContent): Record<string, unknown> {
  const p: Record<string, unknown> = {
    app_id: app.appId,
    target_channel: "push",
    headings: { en: c.title },
    contents: { en: c.message },
    large_icon: BRAND_ICON,
    huawei_large_icon: BRAND_ICON,
    chrome_web_icon: BRAND_ICON,
    firefox_icon: BRAND_ICON,
  };
  if (c.image_url) {
    p.big_picture = c.image_url;
    p.chrome_web_image = c.image_url;
  }
  if (c.send_after) p.send_after = c.send_after;
  if (app.platform === "web") {
    // Unchanged from before: the website opens the deep link.
    if (c.deep_link) p.url = c.deep_link;
  } else {
    // A url would open the phone's browser; the app reads these and opens its own screen.
    const data: Record<string, string> = {};
    if (c.deep_link) data.deep_link = c.deep_link;
    if (c.action_url) data.action_url = c.action_url;
    if (Object.keys(data).length) p.data = data;
  }
  if (c.external_user_ids && c.external_user_ids.length > 0) {
    p.include_aliases = { external_id: c.external_user_ids };
  } else {
    p.included_segments = c.included_segments ?? ["All"];
    if (c.filters) p.filters = c.filters;
  }
  return p;
}

/** Sends the same notification through every configured app; success if at least one accepts it. */
export async function sendPushToAllApps(content: PushContent): Promise<PushResult> {
  const apps = oneSignalApps();
  const results = await Promise.all(apps.map(async (app) => {
    // The API takes at most 2,000 external ids per request.
    const ids = content.external_user_ids ?? [];
    const batches = ids.length > 2000
      ? Array.from({ length: Math.ceil(ids.length / 2000) }, (_, i) => ids.slice(i * 2000, (i + 1) * 2000))
      : [ids];
    let ok = false, firstId: string | null = null;
    const errors: unknown[] = [];
    for (const batch of batches) {
      try {
        const res = await oneSignalFetch(app, "/notifications?c=push", "POST",
          payloadFor(app, { ...content, external_user_ids: ids.length ? batch : undefined }));
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.id) { ok = true; firstId ??= data.id ?? null; }
        if (data.errors) errors.push(data.errors);
        else if (!res.ok) errors.push(`HTTP ${res.status}`);
      } catch (e) {
        errors.push((e as Error).message);
      }
    }
    if (!ok) console.warn(`OneSignal ${app.platform} push refused:`, JSON.stringify(errors));
    return { platform: app.platform, ok, id: firstId, errors: errors.length ? errors : null };
  }));
  return { success: results.some((r) => r.ok), id: results.find((r) => r.ok)?.id ?? null, results };
}

/** Updates a user's properties (e.g. the subscription tag) in every configured app. */
export async function updateUserInAllApps(externalId: string, body: Record<string, unknown>) {
  const apps = oneSignalApps();
  return Promise.all(apps.map(async (app) => {
    try {
      const res = await oneSignalFetch(
        app,
        `/apps/${app.appId}/users/by/external_id/${encodeURIComponent(externalId)}`,
        "PATCH",
        body,
      );
      return { platform: app.platform, ok: res.ok, status: res.status, data: await res.json().catch(() => null) };
    } catch (e) {
      return { platform: app.platform, ok: false, status: 0, data: (e as Error).message };
    }
  }));
}
