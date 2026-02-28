import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useIsPremium = () => {
  const { user } = useAuth();
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subscriptionExpiry, setSubscriptionExpiry] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setIsPremium(false);
      setSubscriptionExpiry(null);
      setLoading(false);
      return;
    }

    supabase.from("user_subscriptions")
      .select("subscription, subscription_expiry_date")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        const isActive = data?.subscription === "premium" || data?.subscription === "trial";
        const expiry = (data as any)?.subscription_expiry_date;
        // If there's an expiry date, check it hasn't passed
        if (isActive && expiry && new Date(expiry) < new Date()) {
          setIsPremium(false);
        } else {
          setIsPremium(isActive);
        }
        setSubscriptionExpiry(expiry || null);
        setLoading(false);
      });
  }, [user]);

  return { isPremium, loading, subscriptionExpiry };
};
