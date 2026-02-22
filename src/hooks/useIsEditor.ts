import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useIsEditor = () => {
  const { user } = useAuth();
  const [isEditor, setIsEditor] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsEditor(false);
      setLoading(false);
      return;
    }

    supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "editor").maybeSingle()
      .then(({ data }) => {
        setIsEditor(!!data);
        setLoading(false);
      });
  }, [user]);

  return { isEditor, loading };
};
