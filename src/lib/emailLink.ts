/** What a "confirm your email" link carries in its address. */
export type ConfirmLink =
  | { kind: "error" }
  | { kind: "tokens"; accessToken: string; refreshToken: string }
  | { kind: "code"; code: string }
  | { kind: "token_hash"; tokenHash: string; type: "signup" | "email" }
  | { kind: "none" };

const PRODUCTION_ORIGIN = "https://loveworldmusickaraoke.com";

/** Auth email links always land on the production site, except during local development. */
export const siteOrigin = (): string => {
  const host = typeof window === "undefined" ? "" : window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" ? window.location.origin : PRODUCTION_ORIGIN;
};

export const confirmRedirectUrl = () => `${siteOrigin()}/auth/confirm`;

/** Reads a sign-up confirmation link from the address bar's query (`search`) and `hash`. */
export const parseConfirmLink = (search: string, hash: string): ConfirmLink => {
  const q = new URLSearchParams(search.replace(/^\?/, ""));
  const h = new URLSearchParams(hash.replace(/^#/, ""));
  const has = (k: string) => q.has(k) || h.has(k);
  if (has("error") || has("error_code") || has("error_description")) return { kind: "error" };

  const accessToken = h.get("access_token");
  const refreshToken = h.get("refresh_token");
  if (accessToken && refreshToken) return { kind: "tokens", accessToken, refreshToken };

  const code = q.get("code");
  if (code) return { kind: "code", code };

  const tokenHash = q.get("token_hash");
  const type = q.get("type");
  if (tokenHash && (type === "signup" || type === "email")) return { kind: "token_hash", tokenHash, type };

  return { kind: "none" };
};

/** True when the address carries an auth email result that the confirm page should handle. */
export const hasAuthCallback = (search: string, hash: string) => {
  const h = new URLSearchParams(hash.replace(/^#/, ""));
  const q = new URLSearchParams(search.replace(/^\?/, ""));
  return h.has("access_token") || h.has("error_code") || h.has("error") || q.has("error_code") || q.has("token_hash") || q.has("code");
};

/** Seconds to wait from a "you can only request this after N seconds" message (default 60). */
export const resendWaitSeconds = (message: string | undefined): number => {
  const m = /after (\d+) seconds?/i.exec(message || "");
  return m ? Number(m[1]) : 60;
};
