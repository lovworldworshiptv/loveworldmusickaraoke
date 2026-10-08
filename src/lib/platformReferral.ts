import { supabase } from "@/integrations/supabase/client";

const KEY = "lw_platform_invite";
export const PRODUCTION_ORIGIN = "https://loveworldmusickaraoke.com";

/** Personal invite link — always on the production domain. */
export const buildInviteUrl = (username: string) =>
  `${PRODUCTION_ORIGIN}/auth?invite=${encodeURIComponent(username)}`;

/** Remember an incoming ?invite= code so it survives the sign-up / OAuth round-trip. */
export const captureInviteFromUrl = () => {
  try {
    const code = new URLSearchParams(window.location.search).get("invite");
    if (code && code.trim()) localStorage.setItem(KEY, code.trim().slice(0, 80));
  } catch { /* storage unavailable */ }
};

/** Link the signed-in new account to its referrer (server validates: new account, no self-referral, once only). */
export const claimStoredInvite = async () => {
  let code: string | null = null;
  try { code = localStorage.getItem(KEY); } catch { return; }
  if (!code) return;
  const { error } = await supabase.rpc("claim_platform_referral", { p_code: code });
  if (!error) {
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
    if (data !== false) logReferralSignup(code);
  }
};

export const PAYOUT_MIN_ESPEES = 5;
