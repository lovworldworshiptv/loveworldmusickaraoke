import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { canStartTrial } from "@/lib/trial";

// Last known plan per account, so screens opened later start with the right answer
// instead of briefly showing (then hiding) upgrade prompts while it is re-checked.
const known = new Map<string, { isPremium: boolean; isTrial: boolean; expiry: string | null; trialAvailable: boolean }>();

export const useIsPremium = () => {
  const { user } = useAuth();
  const cached = user ? known.get(user.id) : undefined;
  const [isPremium, setIsPremium] = useState(cached?.isPremium ?? false);
  const [isTrial, setIsTrial] = useState(cached?.isTrial ?? false);
  const [loading, setLoading] = useState(!cached);
  const [subscriptionExpiry, setSubscriptionExpiry] = useState<string | null>(cached?.expiry ?? null);
  const [trialAvailable, setTrialAvailable] = useState(cached?.trialAvailable ?? false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!user) {
      setIsPremium(false);
      setIsTrial(false);
      setSubscriptionExpiry(null);
      setTrialAvailable(false);
      setLoading(false);
      return;
    }

    const prior = known.get(user.id);
    if (prior) {
      setIsPremium(prior.isPremium); setIsTrial(prior.isTrial);
      setSubscriptionExpiry(prior.expiry); setTrialAvailable(prior.trialAvailable);
      setLoading(false);
    } else {
      setLoading(true);
    }

    supabase.from("user_subscriptions")
      .select("subscription, subscription_expiry_date, trial_used_at")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const sub = data?.subscription;
        const expiry = data?.subscription_expiry_date ?? null;
        const expired = expiry && new Date(expiry) < new Date();

        const premium = !expired && (sub === "premium" || sub === "trial");
        const trial = !expired && sub === "trial";
        const available = canStartTrial(data ?? null);
        known.set(user.id, { isPremium: premium, isTrial: trial, expiry, trialAvailable: available });
        setIsPremium(premium);
        setIsTrial(trial);
        setTrialAvailable(available);
        setSubscriptionExpiry(expiry);
        setLoading(false);
      });
  }, [user, refreshKey]);

  const refresh = () => setRefreshKey((k) => k + 1);

  return { isPremium, isTrial, loading, subscriptionExpiry, trialAvailable, refresh };
};
