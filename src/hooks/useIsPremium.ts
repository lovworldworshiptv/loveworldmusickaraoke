import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { canStartTrial } from "@/lib/trial";

export const useIsPremium = () => {
  const { user } = useAuth();
  const [isPremium, setIsPremium] = useState(false);
  const [isTrial, setIsTrial] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subscriptionExpiry, setSubscriptionExpiry] = useState<string | null>(null);
  const [trialAvailable, setTrialAvailable] = useState(false);
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

    supabase.from("user_subscriptions")
      .select("subscription, subscription_expiry_date, trial_used_at")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const sub = data?.subscription;
        const expiry = data?.subscription_expiry_date ?? null;
        const expired = expiry && new Date(expiry) < new Date();

        if (expired) {
          setIsPremium(false);
          setIsTrial(false);
        } else {
          setIsPremium(sub === "premium" || sub === "trial");
          setIsTrial(sub === "trial");
        }
        setTrialAvailable(canStartTrial(data ?? null));
        setSubscriptionExpiry(expiry);
        setLoading(false);
      });
  }, [user, refreshKey]);

  const refresh = () => setRefreshKey((k) => k + 1);

  return { isPremium, isTrial, loading, subscriptionExpiry, trialAvailable, refresh };
};
