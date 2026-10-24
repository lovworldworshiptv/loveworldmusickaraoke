// OneSignal push for both apps: the website (web push) and the Android app (com.loveworld.worship)
// are separate OneSignal apps, each with its own REST API key. Every push and tag update goes to
// both; an app whose key isn't configured is skipped, so the website keeps working on its own.
//
// Secrets: ONESIGNAL_APP_ID + ONESIGNAL_REST_API_KEY (website),
//          ONESIGNAL_ANDROID_REST_API_KEY (+ optional ONESIGNAL_ANDROID_APP_ID) for Android.

export type OneSignalPlatform = "web" | "android";

export interface OneSignalApp {
  platform: OneSignalPlatform;
  appId: string;
  apiKey: string;
}

const ANDROID_APP_ID = "171a3c44-9d0e-4177-aa1b-26d8073b6f2f";

export function oneSignalApps(): OneSignalApp[] {
  const apps: OneSignalApp[] = [];
  const webId = Deno.env.get("ONESIGNAL_APP_ID");
  const webKey = Deno.env.get("ONESIGNAL_REST_API_KEY");
  if (webId && webKey) apps.push({ platform: "web", appId: webId, apiKey: webKey });
  const androidId = Deno.env.get("ONESIGNAL_ANDROID_APP_ID") || ANDROID_APP_ID;
  const androidKey = Deno.env.get("ONESIGNAL_ANDROID_REST_API_KEY");
  if (androidKey && androidId !== webId) apps.push({ platform: "android", appId: androidId, apiKey: androidKey });
  return apps;
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

function payloadFor(app: OneSignalApp, c: PushContent): Record<string, unknown> {
  const p: Record<string, unknown> = {
    app_id: app.appId,
    headings: { en: c.title },
    contents: { en: c.message },
  };
  if (c.image_url) p.big_picture = c.image_url;
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
    p.include_external_user_ids = c.external_user_ids;
    p.channel_for_external_user_ids = "push";
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
        const res = await fetch("https://onesignal.com/api/v1/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Basic ${app.apiKey}` },
          body: JSON.stringify(payloadFor(app, { ...content, external_user_ids: ids.length ? batch : undefined })),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) { ok = true; firstId ??= data.id ?? null; }
        if (data.errors) errors.push(data.errors);
      } catch (e) {
        errors.push((e as Error).message);
      }
    }
    return { platform: app.platform, ok, id: firstId, errors: errors.length ? errors : null };
  }));
  return { success: results.some((r) => r.ok), id: results.find((r) => r.ok)?.id ?? null, results };
}

/** Updates a user's properties (e.g. the subscription tag) in every configured app. */
export async function updateUserInAllApps(externalId: string, body: Record<string, unknown>) {
  const apps = oneSignalApps();
  return Promise.all(apps.map(async (app) => {
    try {
      const res = await fetch(
        `https://onesignal.com/api/v1/apps/${app.appId}/users/by/external_id/${encodeURIComponent(externalId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Basic ${app.apiKey}` },
          body: JSON.stringify(body),
        },
      );
      return { platform: app.platform, ok: res.ok, data: await res.json().catch(() => null) };
    } catch (e) {
      return { platform: app.platform, ok: false, data: (e as Error).message };
    }
  }));
}
