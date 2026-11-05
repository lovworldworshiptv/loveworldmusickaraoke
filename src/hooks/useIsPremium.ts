import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { planFromSubscriptionRow, type Plan } from "@/lib/premiumAccess";

const NONE: Plan = { isPremium: false, isTrial: false, expiry: null, trialAvailable: false };

// Last known plan per account, so screens opened later start with the right answer
// instead of briefly showing (then hiding) upgrade prompts while it is re-checked.
const known = new Map<string, Plan>();

const ATTEMPTS = 3;
const BACKOFF_MS = 500;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Read one account's plan. A failed read is retried and never reported as Free:
 * a Premium listener must not be shown upgrade prompts because one request hiccuped.
 */
async function readPlan(userId: string): Promise<Plan | null> {
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const { data, error } = await supabase
      .from("user_subscriptions")
      .select("subscription, subscription_expiry_date, trial_used_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (!error) return planFromSubscriptionRow(data);
    if (attempt < ATTEMPTS - 1) await wait(BACKOFF_MS * (attempt + 1));
  }
  return null;
}

export const useIsPremium = () => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [state, setState] = useState<{ userId: string | null; plan: Plan | null } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    readPlan(user.id).then((plan) => {
      if (cancelled || !plan) return;
      known.set(user.id, plan);
      setState({ userId: user.id, plan });
    });
    return () => { cancelled = true; };
  }, [user, refreshKey]);

  // Decide during render, so a newly signed-in account is never shown as Free for even one frame.
  const fresh = userId && state?.userId === userId ? state.plan : undefined;
  const plan = !userId ? NONE : fresh ?? known.get(userId);
  const loading = !!userId && !plan;
  const resolved = !userId || !!plan;
  const p = plan ?? NONE;

  const refresh = () => setRefreshKey((k) => k + 1);

  return {
    isPremium: p.isPremium,
    isTrial: p.isTrial,
    loading,
    resolved,
    subscriptionExpiry: p.expiry,
    trialAvailable: p.trialAvailable,
    refresh,
  };
};
