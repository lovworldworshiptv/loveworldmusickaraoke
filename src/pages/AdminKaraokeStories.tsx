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
  const [storiesVisible, setStoriesVisible] = useState(true);
  const [recordEnabled, setRecordEnabled] = useState(true);
  const [myKaraokeEnabled, setMyKaraokeEnabled] = useState(true);
  const [bibleWidgetEnabled, setBibleWidgetEnabled] = useState(true);
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!adminLoading && !isAdmin) navigate("/");
  }, [isAdmin, adminLoading]);

  useEffect(() => {
    Promise.all([
      supabase.from("app_settings" as any).select("value").eq("key", "karaoke_stories_visible").single(),
      supabase.from("app_settings" as any).select("value").eq("key", "karaoke_record_enabled").single(),
      supabase.from("app_settings" as any).select("value").eq("key", "my_karaoke_visible").single(),
      supabase.from("app_settings" as any).select("value").eq("key", "bible_widget_enabled").single(),
      supabase.from("app_settings" as any).select("value").eq("key", "reminders_enabled").single(),
    ]).then(([storiesRes, recordRes, myKaraokeRes, bibleRes, remindersRes]: any[]) => {
      if (storiesRes.data) setStoriesVisible(storiesRes.data.value === true);
      if (recordRes.data) setRecordEnabled(recordRes.data.value === true);
      if (myKaraokeRes.data) setMyKaraokeEnabled(myKaraokeRes.data.value === true);
      if (bibleRes.data) setBibleWidgetEnabled(bibleRes.data.value === true);
      if (remindersRes.data) setRemindersEnabled(remindersRes.data.value === true);
      setLoading(false);
    });
  }, []);

  const toggleSetting = async (key: string, val: boolean, setter: (v: boolean) => void) => {
    setter(val);
    const { error } = await supabase
      .from("app_settings" as any)
      .update({ value: val, updated_at: new Date().toISOString() } as any)
      .eq("key", key) as any;
    if (error) {
      // Try upsert if row doesn't exist
      const { error: upsertErr } = await supabase
        .from("app_settings" as any)
        .upsert({ key, value: val, updated_at: new Date().toISOString() } as any) as any;
      if (upsertErr) { toast.error("Failed to update"); return; }
    }
    toast.success(val ? `${key === "karaoke_stories_visible" ? "Karaoke stories visible" : "Record feature enabled"}` : `${key === "karaoke_stories_visible" ? "Karaoke stories hidden" : "Record feature disabled"}`);
  };

  if (loading) return <AppLayout><div className="p-6 text-muted-foreground">Loading…</div></AppLayout>;

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-6 pb-24 max-w-2xl mx-auto space-y-6 animate-fade-in-up">
        <h1 className="text-2xl font-serif font-bold text-foreground">Feature Toggles</h1>
        
        <h2 className="text-lg font-semibold text-foreground">Karaoke</h2>
        <div className="bg-card border border-border rounded-xl p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Show Karaoke Stories on Homepage</Label>
              <p className="text-xs text-muted-foreground mt-1">WhatsApp-style karaoke story bubbles displayed at the top of the homepage</p>
            </div>
            <Switch checked={storiesVisible} onCheckedChange={(v) => toggleSetting("karaoke_stories_visible", v, setStoriesVisible)} />
          </div>

          <div className="border-t border-border" />

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Enable Karaoke Recording</Label>
              <p className="text-xs text-muted-foreground mt-1">Allow users to record their voice over instrumental tracks. When disabled, the Record button is hidden globally.</p>
            </div>
            <Switch checked={recordEnabled} onCheckedChange={(v) => toggleSetting("karaoke_record_enabled", v, setRecordEnabled)} />
          </div>

          <div className="border-t border-border" />

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Show My Karaoke Section</Label>
              <p className="text-xs text-muted-foreground mt-1">Display the "My Karaoke" section on user profiles. When disabled, it disappears for all users.</p>
            </div>
            <Switch checked={myKaraokeEnabled} onCheckedChange={(v) => toggleSetting("my_karaoke_visible", v, setMyKaraokeEnabled)} />
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default AdminKaraokeStories;
