import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useIsPremium = () => {
  const { user } = useAuth();
  const [isPremium, setIsPremium] = useState(false);
  const [isTrial, setIsTrial] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subscriptionExpiry, setSubscriptionExpiry] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setIsPremium(false);
      setIsTrial(false);
      setSubscriptionExpiry(null);
      setLoading(false);
      return;
    }

    supabase.from("user_subscriptions")
      .select("subscription, subscription_expiry_date")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        const sub = data?.subscription;
        const expiry = (data as any)?.subscription_expiry_date;
        const expired = expiry && new Date(expiry) < new Date();

        if (expired) {
          setIsPremium(false);
          setIsTrial(false);
        } else {
          setIsPremium(sub === "premium" || sub === "trial");
          setIsTrial(sub === "trial");
        }
        setSubscriptionExpiry(expiry || null);
        setLoading(false);
      });
  }, [user]);

  return { isPremium, isTrial, loading, subscriptionExpiry };
};
