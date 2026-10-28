import { supabase } from "@/integrations/supabase/client";
import { captureShareSource, logReferralSignup } from "@/lib/acquisitionAnalytics";

const KEY = "lw_platform_invite";
export const PRODUCTION_ORIGIN = "https://loveworldmusickaraoke.com";

/**
 * Personal invite link — always on the production domain. The friendly name is
 * shown to visitors; the account reference makes the credit exact even when
 * several people share the same name.
 */
export const buildInviteUrl = (username: string, userId?: string | null) => {
  const params = new URLSearchParams({ invite: username });
  if (userId) params.set("ref", userId);
  return `${PRODUCTION_ORIGIN}/auth?${params.toString()}`;
};

/** Pick the most precise code from a query string (account reference wins over the name). */
export const inviteCodeFromSearch = (search: string): string | null => {
  const params = new URLSearchParams(search);
  const code = (params.get("ref") || params.get("invite") || "").trim();
  return code ? code.slice(0, 80) : null;
};

export const getStoredInvite = (): string | null => {
  try { return localStorage.getItem(KEY); } catch { return null; }
};

export const storeInvite = (code: string | null | undefined) => {
  const clean = (code || "").trim().slice(0, 80);
  try {
    if (clean) localStorage.setItem(KEY, clean);
    else localStorage.removeItem(KEY);
  } catch { /* storage unavailable */ }
};

/** Remember an incoming invite so it survives the sign-up / OAuth / email-confirmation round-trip. */
export const captureInviteFromUrl = () => {
  captureShareSource();
  try {
    const code = inviteCodeFromSearch(window.location.search);
    if (code) storeInvite(code);
  } catch { /* ignore */ }
};

/** Name of the person behind an invite code, or null when unknown / ambiguous / referrals off. */
export const lookupInviter = async (code: string): Promise<string | null> => {
  if (!code.trim()) return null;
  const { data, error } = await supabase.rpc("invite_referrer_name", { p_code: code.trim() });
  return error ? null : (data as string | null) ?? null;
};

let claiming = false;

/**
 * Link the signed-in new account to its referrer (server validates: new account,
 * no self-referral, once only). Falls back to the code saved on the account at
 * sign-up, so confirming the email on another device still credits the inviter.
 */
export const claimStoredInvite = async (metadataCode?: string | null) => {
  if (claiming) return;
  const code = getStoredInvite() || (metadataCode || "").trim() || null;
  if (!code) return;
  claiming = true;
  try {
    const { data, error } = await supabase.rpc("claim_platform_referral", { p_code: code });
    if (!error) {
      storeInvite(null);
      if (data === true) logReferralSignup(code);
    }
  } finally {
    claiming = false;
  }
};

export const PAYOUT_MIN_ESPEES = 5;
