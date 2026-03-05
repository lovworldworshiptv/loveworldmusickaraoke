import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ImageUploadPicker from "@/components/admin/ImageUploadPicker";
import { toast } from "sonner";
import { Save, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PopupConfig {
  id: string;
  enabled: boolean;
  homepage_only: boolean;
  delay_seconds: number;
  show_frequency: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  image_position: string;
  primary_button_text: string | null;
  primary_button_url: string | null;
  primary_button_new_tab: boolean;
  secondary_button_text: string | null;
  secondary_button_url: string | null;
  secondary_button_new_tab: boolean;
  bg_color: string | null;
  text_color: string | null;
  button_color: string | null;
  button_text_color: string | null;
  border_radius: string | null;
  max_width: string | null;
  target_segment: string;
  target_user_ids: string[] | null;
}

const AdminPopup = () => {
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const navigate = useNavigate();
  const [config, setConfig] = useState<PopupConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<{ id: string; username: string }[]>([]);

  useEffect(() => {
    if (!adminLoading && !isAdmin) navigate("/");
  }, [isAdmin, adminLoading]);

  useEffect(() => {
    supabase.from("homepage_popup").select("*").limit(1).single().then(({ data }) => {
      if (data) setConfig(data as unknown as PopupConfig);
    });
  }, []);

  const save = async () => {
    if (!config) return;
    setSaving(true);
    const { error } = await supabase.from("homepage_popup").update({
      enabled: config.enabled,
      homepage_only: config.homepage_only,
      delay_seconds: config.delay_seconds,
      show_frequency: config.show_frequency,
      title: config.title,
      description: config.description,
      image_url: config.image_url,
      image_position: config.image_position,
      primary_button_text: config.primary_button_text,
      primary_button_url: config.primary_button_url,
      primary_button_new_tab: config.primary_button_new_tab,
      secondary_button_text: config.secondary_button_text,
      secondary_button_url: config.secondary_button_url,
      secondary_button_new_tab: config.secondary_button_new_tab,
      bg_color: config.bg_color,
      text_color: config.text_color,
      button_color: config.button_color,
      button_text_color: config.button_text_color,
      border_radius: config.border_radius,
      max_width: config.max_width,
      target_segment: config.target_segment,
      target_user_ids: config.target_segment === "specific" ? selectedUsers.map(u => u.id) : null,
    } as any).eq("id", config.id);
    setSaving(false);
    if (error) toast.error("Save failed: " + error.message);
    else toast.success("Popup settings saved!");
  };

  const searchUsers = async (q: string) => {
    setUserSearch(q);
    if (q.length < 2) { setSearchResults([]); return; }
    const { data } = await supabase.from("profiles").select("user_id, username, email").or(`username.ilike.%${q}%,email.ilike.%${q}%`).limit(10);
    setSearchResults(data || []);
  };

  const addUser = (u: any) => {
    if (!selectedUsers.find(x => x.id === u.user_id)) {
      setSelectedUsers(prev => [...prev, { id: u.user_id, username: u.username }]);
    }
    setUserSearch("");
    setSearchResults([]);
  };

  const removeUser = (id: string) => setSelectedUsers(prev => prev.filter(u => u.id !== id));

  const upd = (key: keyof PopupConfig, val: any) => setConfig(prev => prev ? { ...prev, [key]: val } : prev);

  if (!config) return <AppLayout><div className="p-6 text-muted-foreground">Loading…</div></AppLayout>;

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-6 pb-24 max-w-2xl mx-auto space-y-8 animate-fade-in-up">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-serif font-bold gradient-gold-text">Homepage Popup</h1>
          <Button onClick={save} disabled={saving} className="gradient-gold text-primary-foreground">
            <Save className="w-4 h-4 mr-2" /> {saving ? "Saving…" : "Save"}
          </Button>
        </div>

        {/* Visibility & Logic */}
        <section className="space-y-4 bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Visibility & Logic</h2>
          <div className="flex items-center justify-between">
            <Label>Enable Popup</Label>
            <Switch checked={config.enabled} onCheckedChange={v => upd("enabled", v)} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Show On Homepage Only</Label>
            <Switch checked={config.homepage_only} onCheckedChange={v => upd("homepage_only", v)} />
          </div>
          <div className="space-y-1">
            <Label>Popup Delay (seconds)</Label>
            <Input type="number" min={0} max={30} value={config.delay_seconds} onChange={e => upd("delay_seconds", Number(e.target.value))} className="bg-muted" />
          </div>
          <div className="space-y-1">
            <Label>Show Frequency</Label>
            <Select value={config.show_frequency} onValueChange={v => upd("show_frequency", v)}>
              <SelectTrigger className="bg-muted"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="every_visit">Every visit</SelectItem>
                <SelectItem value="once_per_session">Once per session</SelectItem>
                <SelectItem value="once_per_day">Once per day</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </section>

        {/* Targeting */}
        <section className="space-y-4 bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2"><Users className="w-4 h-4" /> Targeting</h2>
          <div className="space-y-1">
            <Label>Show To</Label>
            <Select value={config.target_segment} onValueChange={v => upd("target_segment", v)}>
              <SelectTrigger className="bg-muted"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                <SelectItem value="free">Free Users Only</SelectItem>
                <SelectItem value="premium">Premium Users Only</SelectItem>
                <SelectItem value="trial">Trial Users Only</SelectItem>
                <SelectItem value="specific">Specific Users</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {config.target_segment === "specific" && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Search Users</Label>
                <Input value={userSearch} onChange={e => searchUsers(e.target.value)} placeholder="Search by name or email" className="bg-muted" />
              </div>
              {searchResults.length > 0 && (
                <div className="border border-border rounded-lg max-h-40 overflow-y-auto">
                  {searchResults.map(u => (
                    <button key={u.user_id} onClick={() => addUser(u)} className="w-full px-3 py-2 text-sm text-left hover:bg-muted transition-colors flex items-center justify-between">
                      <span>{u.username}</span>
                      <span className="text-xs text-muted-foreground">{u.email}</span>
                    </button>
                  ))}
                </div>
              )}
              {selectedUsers.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedUsers.map(u => (
                    <Badge key={u.id} variant="secondary" className="flex items-center gap-1">
                      {u.username}
                      <button onClick={() => removeUser(u.id)} className="ml-1 text-muted-foreground hover:text-foreground">×</button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Content Fields */}
        <section className="space-y-4 bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Content</h2>
          <div className="space-y-1">
            <Label>Popup Title</Label>
            <Input value={config.title || ""} onChange={e => upd("title", e.target.value)} placeholder="Enter title" className="bg-muted" />
          </div>
          <div className="space-y-1">
            <Label>Popup Description</Label>
            <Textarea value={config.description || ""} onChange={e => upd("description", e.target.value)} placeholder="Enter description" className="bg-muted min-h-[100px]" />
          </div>
          <ImageUploadPicker bucket="hero-banners" label="Popup Image" value={config.image_url || ""} onChange={v => upd("image_url", v)} />
          <div className="space-y-1">
            <Label>Image Position</Label>
            <Select value={config.image_position} onValueChange={v => upd("image_position", v)}>
              <SelectTrigger className="bg-muted"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="top">Top banner</SelectItem>
                <SelectItem value="background">Full background</SelectItem>
                <SelectItem value="none">No image</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </section>

        {/* CTA Buttons */}
        <section className="space-y-4 bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">CTA Buttons</h2>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground font-medium">Primary Button</p>
            <Input value={config.primary_button_text || ""} onChange={e => upd("primary_button_text", e.target.value)} placeholder="Button text" className="bg-muted" />
            <Input value={config.primary_button_url || ""} onChange={e => upd("primary_button_url", e.target.value)} placeholder="Button URL" className="bg-muted" />
            <div className="flex items-center justify-between">
              <Label className="text-xs">Open in New Tab</Label>
              <Switch checked={config.primary_button_new_tab} onCheckedChange={v => upd("primary_button_new_tab", v)} />
            </div>
          </div>
          <div className="space-y-3 pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground font-medium">Secondary Button (optional)</p>
            <Input value={config.secondary_button_text || ""} onChange={e => upd("secondary_button_text", e.target.value)} placeholder="Button text" className="bg-muted" />
            <Input value={config.secondary_button_url || ""} onChange={e => upd("secondary_button_url", e.target.value)} placeholder="Button URL" className="bg-muted" />
            <div className="flex items-center justify-between">
              <Label className="text-xs">Open in New Tab</Label>
              <Switch checked={config.secondary_button_new_tab} onCheckedChange={v => upd("secondary_button_new_tab", v)} />
            </div>
          </div>
        </section>

        {/* Style Controls */}
        <section className="space-y-4 bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Style Controls</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Background Color</Label>
              <div className="flex gap-2 items-center">
                <input type="color" value={config.bg_color || "#1a1a2e"} onChange={e => upd("bg_color", e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
                <Input value={config.bg_color || ""} onChange={e => upd("bg_color", e.target.value)} className="bg-muted text-xs" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Text Color</Label>
              <div className="flex gap-2 items-center">
                <input type="color" value={config.text_color || "#ffffff"} onChange={e => upd("text_color", e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
                <Input value={config.text_color || ""} onChange={e => upd("text_color", e.target.value)} className="bg-muted text-xs" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Button Color</Label>
              <div className="flex gap-2 items-center">
                <input type="color" value={config.button_color || "#d4af37"} onChange={e => upd("button_color", e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
                <Input value={config.button_color || ""} onChange={e => upd("button_color", e.target.value)} className="bg-muted text-xs" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Button Text Color</Label>
              <div className="flex gap-2 items-center">
                <input type="color" value={config.button_text_color || "#000000"} onChange={e => upd("button_text_color", e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
                <Input value={config.button_text_color || ""} onChange={e => upd("button_text_color", e.target.value)} className="bg-muted text-xs" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Border Radius</Label>
              <Input value={config.border_radius || ""} onChange={e => upd("border_radius", e.target.value)} placeholder="16px" className="bg-muted text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Max Width</Label>
              <Input value={config.max_width || ""} onChange={e => upd("max_width", e.target.value)} placeholder="480px" className="bg-muted text-xs" />
            </div>
          </div>
        </section>
      </div>
    </AppLayout>
  );
};

export default AdminPopup;
