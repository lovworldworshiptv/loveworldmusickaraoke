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

    supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "premium").maybeSingle()
      .then(({ data }) => {
        setIsPremium(!!data);
        setLoading(false);
      });
  }, [user]);

  return { isPremium, loading };
};
