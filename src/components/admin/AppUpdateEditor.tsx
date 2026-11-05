import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getSetting, saveSetting } from "@/lib/siteSettings";
import { APP_UPDATE_KEY, type AppUpdateNotice } from "@/lib/appUpdate";

/** Admin controls for the "update your app" popup. */
const AppUpdateEditor = () => {
  const [n, setN] = useState<AppUpdateNotice>({ enabled: false });
  useEffect(() => { getSetting<AppUpdateNotice>(APP_UPDATE_KEY).then((v) => v && setN(v)); }, []);

  const save = async (next: AppUpdateNotice, msg: string) => {
    setN(next);
    const { error } = await saveSetting(APP_UPDATE_KEY, next);
    error ? toast.error("Could not save the update notice") : toast.success(msg);
  };

  const send = () => save({ ...n, enabled: true, version: new Date().toISOString() }, "Update sent to all users");

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Asks everyone to update. Once someone taps the update button they won't see it again until you send a new update. Leave the link empty to refresh the website to its newest version.</p>
      <Input placeholder="Title (e.g. A new update is available)" value={n.title || ""} onChange={(e) => setN({ ...n, title: e.target.value })} />
      <Textarea placeholder="Message" value={n.message || ""} onChange={(e) => setN({ ...n, message: e.target.value })} />
      <Input placeholder="Button text (e.g. Update now)" value={n.buttonLabel || ""} onChange={(e) => setN({ ...n, buttonLabel: e.target.value })} />
      <Input placeholder="Update link (optional, https://…)" value={n.url || ""} onChange={(e) => setN({ ...n, url: e.target.value })} />
      <div className="space-y-1">
        <label htmlFor="latest-version-code" className="text-sm text-foreground">Newest Android version code (optional)</label>
        <Input id="latest-version-code" type="number" inputMode="numeric" min={1} step={1} placeholder="e.g. 105"
          value={n.latestVersionCode ?? ""}
          onChange={(e) => {
            const v = e.target.value.trim();
            const num = Number(v);
            const next = { ...n };
            if (!v || !Number.isInteger(num) || num < 1) delete next.latestVersionCode; else next.latestVersionCode = num;
            setN(next);
          }} />
        <p className="text-[11px] text-muted-foreground">Android phones already on this version or newer won't see the popup.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={send}>Send update to all users</Button>
        <Button variant="outline" onClick={() => save(n, "Update notice saved")}>Save without resending</Button>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <Switch checked={n.enabled === true} onCheckedChange={(v) => save({ ...n, enabled: v }, v ? "Update notice on" : "Update notice off")} />
          Showing
        </label>
      </div>
      {n.version && <p className="text-[11px] text-muted-foreground">Last sent {new Date(n.version).toLocaleString()}</p>}
    </div>
  );
};

export default AppUpdateEditor;
