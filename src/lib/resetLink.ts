/** What a "set a new password" email link carries in its address. */
export type ResetLink =
  | { kind: "error" }
  | { kind: "tokens"; accessToken: string; refreshToken: string }
  | { kind: "code"; code: string }
  | { kind: "token_hash"; tokenHash: string }
  | { kind: "none" };

/** Reads the reset link from the address bar's query (`search`) and `hash`. */
export const parseResetLink = (search: string, hash: string): ResetLink => {
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
  if (tokenHash && q.get("type") === "recovery") return { kind: "token_hash", tokenHash };

  return { kind: "none" };
};
