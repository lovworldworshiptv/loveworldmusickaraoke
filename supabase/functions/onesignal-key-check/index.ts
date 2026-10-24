// Temporary diagnostic: describes the shape of the stored OneSignal keys without revealing them.
function b32decode(s: string): Uint8Array {
  const alpha = "abcdefghijklmnopqrstuvwxyz234567";
  let bits = 0, val = 0; const out: number[] = [];
  for (const ch of s.toLowerCase()) {
    const i = alpha.indexOf(ch); if (i < 0) continue;
    val = (val << 5) | i; bits += 5;
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; }
  }
  return new Uint8Array(out);
}
function uuidFromBytes(b: Uint8Array) {
  const h = Array.from(b.slice(0, 16)).map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}
function describe(key: string | undefined, appId: string | undefined) {
  const raw = key ?? "";
  const k = raw.trim();
  const v2 = k.startsWith("os_v2_app_");
  let embeddedMatches: boolean | null = null;
  let embeddedApp: string | null = null;
  if (v2) {
    const body = k.slice("os_v2_app_".length);
    embeddedApp = uuidFromBytes(b32decode(body.slice(0, 26)));
    embeddedMatches = embeddedApp === (appId ?? "").trim().toLowerCase();
  }
  return {
    present: raw.length > 0, length: k.length, hadSurroundingSpaces: raw !== k,
    format: v2 ? "os_v2_app" : k.startsWith("os_v2_") ? "os_v2_other(org/user key)" : k ? "legacy" : "none",
    appIdConfigured: appId ?? null, looksLikeUuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k), equalsWebAppId: k === (Deno.env.get("ONESIGNAL_APP_ID") ?? "").trim(), equalsAndroidAppId: k === "171a3c44-9d0e-4177-aa1b-26d8073b6f2f", keyBelongsToApp: embeddedApp, keyMatchesApp: embeddedMatches,
  };
}
Deno.serve(() => new Response(JSON.stringify({
  web: describe(Deno.env.get("ONESIGNAL_REST_API_KEY"), Deno.env.get("ONESIGNAL_APP_ID")),
  android: describe(Deno.env.get("ONESIGNAL_ANDROID_REST_API_KEY"), Deno.env.get("ONESIGNAL_ANDROID_APP_ID") || "171a3c44-9d0e-4177-aa1b-26d8073b6f2f"),
}), { headers: { "Content-Type": "application/json" } }));
