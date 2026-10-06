import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FEATURES, featureForPath, isFeatureEnabled, type FeatureId, type FeatureValues } from "@/lib/featureFlags";
import { Navigate, useLocation } from "react-router-dom";

const FeatureContext = createContext({
  values: {} as FeatureValues, loading: false,
  enabled: (_id: FeatureId): boolean => true,
  pathEnabled: (_path: string): boolean => true,
  refresh: async () => {},
});

export const useFeatures = () => useContext(FeatureContext);

export function FeatureProvider({ children }: { children: ReactNode }) {
  const [values, setValues] = useState<FeatureValues>({});
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    const { data, error } = await supabase.from("app_settings").select("key,value").in("key", FEATURES.map((f) => f.key));
    if (!error) {
      const next: FeatureValues = {};
      for (const feature of FEATURES) {
        const row = data?.find((s) => s.key === feature.key);
        next[feature.id] = row?.value !== false;
      }
      setValues(next);
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [refresh]);
  const enabled = useCallback((id: FeatureId) => !loading && isFeatureEnabled(values, id), [loading, values]);
  const pathEnabled = useCallback((path: string) => {
    const feature = featureForPath(path);
    return !feature || enabled(feature);
  }, [enabled]);
  return <FeatureContext.Provider value={{ values, loading, enabled, pathEnabled, refresh }}>{children}</FeatureContext.Provider>;
}

export function FeatureRouteGate({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { loading, pathEnabled } = useFeatures();
  if (featureForPath(pathname) && loading) return <div role="status" className="p-6 text-foreground">Loading…</div>;
  return pathEnabled(pathname) ? <>{children}</> : <Navigate to="/" replace />;
}