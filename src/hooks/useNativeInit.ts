import { useEffect } from "react";
import { initPushNotifications, cleanupPushNotifications } from "@/lib/nativeService";

/**
 * Hook to initialize native capabilities on app launch.
 * Call once at the top level (e.g., App or main layout).
 */
export const useNativeInit = () => {
  useEffect(() => {
    initPushNotifications();
    return () => {
      cleanupPushNotifications();
    };
  }, []);
};
