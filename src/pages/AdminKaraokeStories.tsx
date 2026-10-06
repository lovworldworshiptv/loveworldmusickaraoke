import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { FEATURES, type FeatureId } from "@/lib/featureFlags";
import { useFeatures } from "@/contexts/FeatureContext";

const AdminKaraokeStories = () => {
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const navigate = useNavigate();
  const { values, loading, refresh } = useFeatures();
  const [saving, setSaving] = useState<FeatureId | null>(null);
  useEffect(() => { if (!adminLoading && !isAdmin) navigate("/"); }, [adminLoading, isAdmin, navigate]);
  const toggle = async (id: FeatureId, key: string, value: boolean) => {
    if (!isAdmin || saving) return;
    setSaving(id);
    const { error } = await supabase.from("app_settings").upsert({ key, value, updated_at: new Date().toISOString() });
    if (error) toast.error("Could not update setting");
    else { await refresh(); toast.success("Setting updated"); }
    setSaving(null);
  };
  if (adminLoading || !isAdmin) return null;
  return <AppLayout>
    <div className="px-4 lg:px-6 pt-6 pb-24 max-w-2xl mx-auto space-y-6 animate-fade-in-up">
      <h1 className="text-2xl font-serif font-bold text-foreground">Feature Toggles</h1>
      {loading ? <p role="status">Loading…</p> : ["Playback", "Experiences", "Explore"].map((group) => <section key={group}>
        <h2 className="text-lg font-semibold text-foreground mb-2">{group}</h2>
        <div className="divide-y divide-border">
          {FEATURES.filter((f) => f.group === group).map((f) => <div key={f.id} className="flex items-center justify-between gap-4 py-4">
            <Label htmlFor={`feature-${f.id}`} className="text-sm text-foreground">{f.label}</Label>
            <Switch id={`feature-${f.id}`} checked={values[f.id] !== false} disabled={saving !== null} onCheckedChange={(value) => toggle(f.id, f.key, value)} />
          </div>)}
        </div>
      </section>)}
    </div>
  </AppLayout>;
};
export default AdminKaraokeStories;
