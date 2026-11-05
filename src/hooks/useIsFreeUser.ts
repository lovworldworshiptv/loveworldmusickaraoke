import { useAuth } from "@/contexts/AuthContext";
import { useIsPremium } from "@/hooks/useIsPremium";
import { seesPremiumUpsell } from "@/lib/premiumAccess";

/**
 * Signed-in listener on the Free plan — the only people premium upsells may be
 * shown to. False while the plan is still being read, so a Premium listener
 * never sees an "Upgrade to Premium" prompt flash in.
 */
export const useIsFreeUser = () => {
  const { user } = useAuth();
  const { isPremium, isTrial, resolved } = useIsPremium();
  return !!user && seesPremiumUpsell({ isPremium, isTrial, resolved });
};
