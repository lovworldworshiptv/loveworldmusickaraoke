import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Syncs the user's External ID and subscription tag with OneSignal.
 * Call this once at the app root level.
 */
export const useOneSignalSync = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Set External User ID on OneSignal SDK (client-side)
    const win = window as any;
    if (win.OneSignalDeferred) {
      win.OneSignalDeferred.push(async (OneSignal: any) => {
        await OneSignal.login(user.id);
      });
    } else if (win.OneSignal) {
      win.OneSignal.login(user.id);
    }

    // Sync subscription tag via backend
    syncSubscriptionTag();
  }, [user?.id]);

  const syncSubscriptionTag = async () => {
    try {
      await supabase.functions.invoke("sync-onesignal-tag");
    } catch (err) {
      console.error("Failed to sync OneSignal tag:", err);
    }
  };

  return { syncSubscriptionTag };
};
