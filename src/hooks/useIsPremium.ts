import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useIsPremium = () => {
  const { user } = useAuth();
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsPremium(false);
      setLoading(false);
      return;
    }

    supabase.from("user_subscriptions").select("subscription").eq("user_id", user.id).single()
      .then(({ data }) => {
        setIsPremium(data?.subscription === "premium");
        setLoading(false);
      });
  }, [user]);

  return { isPremium, loading };
};
