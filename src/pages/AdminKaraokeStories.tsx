import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const AdminKaraokeStories = () => {
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!adminLoading && !isAdmin) navigate("/");
  }, [isAdmin, adminLoading]);

  useEffect(() => {
    supabase
      .from("app_settings" as any)
      .select("value")
      .eq("key", "karaoke_stories_visible")
      .single()
      .then(({ data }: any) => {
        if (data) setVisible(data.value === true);
        setLoading(false);
      });
  }, []);

  const toggleVisibility = async (val: boolean) => {
    setVisible(val);
    const { error } = await supabase
      .from("app_settings" as any)
      .update({ value: val, updated_at: new Date().toISOString() } as any)
      .eq("key", "karaoke_stories_visible") as any;
    if (error) toast.error("Failed to update");
    else toast.success(val ? "Karaoke stories visible" : "Karaoke stories hidden");
  };

  if (loading) return <AppLayout><div className="p-6 text-muted-foreground">Loading…</div></AppLayout>;

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-6 pb-24 max-w-2xl mx-auto space-y-6 animate-fade-in-up">
        <h1 className="text-2xl font-serif font-bold text-foreground">Karaoke Stories</h1>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Show Karaoke Stories on Homepage</Label>
              <p className="text-xs text-muted-foreground mt-1">WhatsApp-style karaoke story bubbles displayed at the top of the homepage</p>
            </div>
            <Switch checked={visible} onCheckedChange={toggleVisibility} />
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default AdminKaraokeStories;
