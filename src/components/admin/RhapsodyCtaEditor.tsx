import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SETTING_KEYS, getSetting, saveSetting, type RhapsodyAppCta } from "@/lib/siteSettings";

const FIELDS: { key: keyof RhapsodyAppCta; label: string; placeholder: string }[] = [
  { key: "label", label: "Button text", placeholder: "Get Rhapsody App" },
  { key: "url", label: "Main link (computers and other devices)", placeholder: "https://…" },
  { key: "androidUrl", label: "Android link (Google Play)", placeholder: "https://play.google.com/…" },
  { key: "iosUrl", label: "iPhone link (App Store)", placeholder: "https://apps.apple.com/…" },
];

/** Admin controls for the "Get Rhapsody App" button on the Rhapsody Daily section. */
export default function RhapsodyCtaEditor() {
  const [cta, setCta] = useState<RhapsodyAppCta>({ enabled: true });
  const [saving, setSaving] = useState(false);

  useEffect(() => { getSetting<RhapsodyAppCta>(SETTING_KEYS.rhapsodyAppCta).then(v => v && setCta(v)); }, []);

  const save = async () => {
    const links = [cta.url, cta.androidUrl, cta.iosUrl].filter(l => l?.trim());
    if (links.some(l => !/^https?:\/\//i.test(l!.trim()))) { toast.error("Links must start with https://"); return; }
    setSaving(true);
    const { error } = await saveSetting(SETTING_KEYS.rhapsodyAppCta, cta);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Rhapsody app button saved");
  };

  return (
    <div className="glass-card p-5 mb-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-serif font-bold text-foreground">Rhapsody Daily app button</h3>
          <p className="text-xs text-muted-foreground">Shown next to Listen. Phones get their store link when one is set.</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground">
          Show <Switch checked={cta.enabled !== false} onCheckedChange={v => setCta({ ...cta, enabled: v })} />
        </label>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {FIELDS.map(f => (
          <label key={f.key} className="text-xs text-foreground space-y-1">
            <span>{f.label}</span>
            <input value={(cta[f.key] as string) || ""} placeholder={f.placeholder}
              onChange={e => setCta({ ...cta, [f.key]: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm" />
          </label>
        ))}
      </div>
      <Button onClick={save} disabled={saving} className="gradient-gold text-primary-foreground gap-2">
        <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save button"}
      </Button>
    </div>
  );
}
