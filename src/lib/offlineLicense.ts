/**
 * Offline License Manager
 * Manages subscription-based offline playback with 7-day validation windows.
 */

import { supabase } from "@/integrations/supabase/client";

const LICENSE_KEY = "lmk_offline_licenses";

interface OfflineLicense {
  trackId: string;
  subscriptionExpiryDate: string;
  offlineLicenseExpiryDate: string;
  lastValidatedAt: string;
}

function getLicenses(): Record<string, OfflineLicense> {
  try {
    return JSON.parse(localStorage.getItem(LICENSE_KEY) || "{}");
  } catch { return {}; }
}

function saveLicenses(licenses: Record<string, OfflineLicense>) {
  localStorage.setItem(LICENSE_KEY, JSON.stringify(licenses));
}

export function setTrackLicense(trackId: string, subscriptionExpiryDate: string) {
  const licenses = getLicenses();
  const now = new Date();
  const subExpiry = new Date(subscriptionExpiryDate);
  const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const offlineExpiry = subExpiry < sevenDays ? subExpiry : sevenDays;

  licenses[trackId] = {
    trackId,
    subscriptionExpiryDate,
    offlineLicenseExpiryDate: offlineExpiry.toISOString(),
    lastValidatedAt: now.toISOString(),
  };
  saveLicenses(licenses);
}

export type PlaybackCheckResult =
  | { allowed: true }
  | { allowed: false; reason: "expired"; message: string }
  | { allowed: false; reason: "needs_validation"; message: string };

export function checkPlaybackAllowed(trackId: string): PlaybackCheckResult {
  const licenses = getLicenses();
  const license = licenses[trackId];

  // No license = free download or no restriction
  if (!license) return { allowed: true };

  const now = new Date();
  const subExpiry = new Date(license.subscriptionExpiryDate);
  const offlineExpiry = new Date(license.offlineLicenseExpiryDate);

  if (now > subExpiry) {
    return {
      allowed: false,
      reason: "expired",
      message: "Your subscription has expired. Renew to continue accessing offline downloads.",
    };
  }

  if (now > offlineExpiry) {
    return {
      allowed: false,
      reason: "needs_validation",
      message: "Connect to the internet to verify your subscription.",
    };
  }

  return { allowed: true };
}

export async function revalidateLicense(trackId: string, userId: string): Promise<PlaybackCheckResult> {
  try {
    const { data } = await supabase
      .from("user_subscriptions")
      .select("subscription, subscription_expiry_date")
      .eq("user_id", userId)
      .single();

    const isActive = data?.subscription === "premium";
    const expiry = (data as any)?.subscription_expiry_date;

    if (!isActive || !expiry || new Date(expiry) < new Date()) {
      return {
        allowed: false,
        reason: "expired",
        message: "Your subscription has expired. Renew to continue accessing offline downloads.",
      };
    }

    // Renew license
    setTrackLicense(trackId, expiry);
    return { allowed: true };
  } catch {
    return {
      allowed: false,
      reason: "needs_validation",
      message: "Unable to verify subscription. Please check your internet connection.",
    };
  }
}
