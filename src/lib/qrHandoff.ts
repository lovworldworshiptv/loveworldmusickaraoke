/** What to do when a page opens from a scanned QR share card (?src=qr_card). */
export const ANDROID_PACKAGE = "com.loveworld.worship";
export const QR_HOST = "loveworldmusickaraoke.com";

export type QrHandoff = { kind: "intent"; url: string } | { kind: "sheet" } | null;

export function isAndroid(ua: string): boolean {
  return /android/i.test(ua);
}

/** Android intent link: opens the app if installed, otherwise its Play Store page. */
export function androidIntentUrl(pathAndQuery: string): string {
  const p = pathAndQuery.startsWith("/") ? pathAndQuery : `/${pathAndQuery}`;
  return `intent://${QR_HOST}${p}#Intent;scheme=https;package=${ANDROID_PACKAGE};end`;
}

export function qrHandoff(pathname: string, search: string, ua: string, insideApp: boolean): QrHandoff {
  if (insideApp) return null;
  if (new URLSearchParams(search).get("src") !== "qr_card") return null;
  if (isAndroid(ua)) return { kind: "intent", url: androidIntentUrl(pathname + search) };
  return { kind: "sheet" };
}
