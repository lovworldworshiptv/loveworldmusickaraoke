import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { canStartTrial } from "@/lib/trial";

interface Plan { isPremium: boolean; isTrial: boolean; expiry: string | null; trialAvailable: boolean }

const NONE: Plan = { isPremium: false, isTrial: false, expiry: null, trialAvailable: false };

// Last known plan per account, so screens opened later start with the right answer
// instead of briefly showing (then hiding) upgrade prompts while it is re-checked.
const known = new Map<string, Plan>();

export const useIsPremium = () => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [state, setState] = useState<{ userId: string | null; plan: Plan } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase.from("user_subscriptions")
      .select("subscription, subscription_expiry_date, trial_used_at")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const sub = data?.subscription;
        const expiry = data?.subscription_expiry_date ?? null;
        const expired = !!expiry && new Date(expiry) < new Date();
        const plan: Plan = {
          isPremium: !expired && (sub === "premium" || sub === "trial"),
          isTrial: !expired && sub === "trial",
          expiry,
          trialAvailable: canStartTrial(data ?? null),
        };
        known.set(user.id, plan);
        if (!cancelled) setState({ userId: user.id, plan });
      });
    return () => { cancelled = true; };
  }, [user, refreshKey]);

  // Decide during render, so a newly signed-in account is never shown as Free for even one frame.
  const fresh = userId && state?.userId === userId ? state.plan : undefined;
  const plan = !userId ? NONE : fresh ?? known.get(userId);
  const loading = !!userId && !plan;
  const p = plan ?? NONE;

  const refresh = () => setRefreshKey((k) => k + 1);

  return { isPremium: p.isPremium, isTrial: p.isTrial, loading, subscriptionExpiry: p.expiry, trialAvailable: p.trialAvailable, refresh };
};
