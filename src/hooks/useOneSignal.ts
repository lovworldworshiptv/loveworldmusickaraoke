import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { isMedianApp } from "@/lib/median";

/**
 * Syncs the user's External ID and subscription tag with OneSignal.
 *
 * Inside a Median native wrapper, OneSignal is handled natively via the
 * Median JS bridge — we must NOT use the web SDK in that context.
 */
export const useOneSignalSync = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    if (isMedianApp()) {
      // Use Median's native OneSignal bridge to set the external user ID.
      // The Median wrapper handles permission prompting natively.
      const med = (window as any).median;
      try {
        med?.onesignal?.externalUserId?.set?.({ externalId: user.id });
      } catch {
        // bridge method may not exist on older Median builds
      }
    } else {
      // Web SDK path (PWA / browser)
      const win = window as any;
      if (win.OneSignalDeferred) {
        win.OneSignalDeferred.push(async (OneSignal: any) => {
          await OneSignal.login(user.id);
        });
      } else if (win.OneSignal) {
        win.OneSignal.login(user.id);
      }
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
