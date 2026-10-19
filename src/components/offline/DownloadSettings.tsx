import { useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSecureDownloads } from "@/hooks/useSecureDownloads";
import { setAllowCellular, setAutoRestore, removeAllFromDevice } from "@/lib/secureDownloads/engine";
import { formatBytes } from "@/lib/secureDownloads/policy";
import DevicesList from "./DevicesList";

/** Settings → Downloads: quality, mobile data, automatic restore, clear this device, devices. */
const DownloadSettings = () => {
  const s = useSecureDownloads();
  const [confirm, setConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);

  const ready = s.items.filter((i) => i.status === "ready");
  const audioSizes = ready.map((i) => i.packages.find((p) => p.kind === "audio")?.byteLength || 0).filter(Boolean);
  const avg = audioSizes.length ? audioSizes.reduce((a, b) => a + b, 0) / audioSizes.length : 0;
  const onDevice = ready.reduce((n, i) => n + i.packages.reduce((m, p) => m + p.byteLength, 0), 0);

  const clear = async () => {
    setClearing(true);
    try {
      await removeAllFromDevice();
      toast.success("Downloads removed from this device. They're still on your account.");
    } catch {
      toast.error("Couldn't remove downloads. Try again.");
    } finally { setClearing(false); setConfirm(false); }
  };

  return (
    <section data-offline-ui aria-labelledby="dl-settings-title" className="space-y-4">
      <h3 id="dl-settings-title" className="text-sm font-semibold text-foreground">Downloads</h3>

      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-muted-foreground mb-1">Download quality</legend>
        <label className="flex items-center gap-3 rounded-xl border border-border p-3 cursor-pointer">
          <input type="radio" name="dl-quality" checked readOnly className="accent-[hsl(var(--offline-accent))] w-4 h-4" aria-describedby="dl-q-std" />
          <span className="flex-1">
            <span className="block text-sm text-foreground">Standard</span>
            <span id="dl-q-std" className="block text-xs text-muted-foreground">{avg ? `About ${formatBytes(avg)} per song` : "Size depends on the song"}</span>
          </span>
        </label>
        <label className="flex items-center gap-3 rounded-xl border border-border p-3 opacity-70" aria-disabled="true">
          <input type="radio" name="dl-quality" disabled className="w-4 h-4" aria-describedby="dl-q-high" />
          <span className="flex-1">
            <span className="block text-sm text-foreground">High</span>
            <span id="dl-q-high" className="block text-xs text-muted-foreground">Not available yet</span>
          </span>
        </label>
      </fieldset>

      <label className="flex items-center justify-between gap-3">
        <span>
          <span className="block text-sm text-foreground">Download over mobile data</span>
          <span className="block text-xs text-muted-foreground">When off, saving waits for Wi-Fi</span>
        </span>
        <Switch checked={s.allowCellular} onCheckedChange={setAllowCellular} aria-label="Download over mobile data" />
      </label>

      <label className="flex items-center justify-between gap-3">
        <span>
          <span className="block text-sm text-foreground">Restore my downloads automatically</span>
          <span className="block text-xs text-muted-foreground">Songs saved on your other devices arrive here on Wi-Fi</span>
        </span>
        <Switch checked={s.autoRestore} onCheckedChange={setAutoRestore} aria-label="Restore my downloads automatically" />
      </label>

      <div className="flex items-center justify-between gap-3">
        <span>
          <span className="block text-sm text-foreground">Remove all downloads from this device</span>
          <span className="block text-xs text-muted-foreground">{ready.length} {ready.length === 1 ? "song" : "songs"} · {formatBytes(onDevice)}</span>
        </span>
        <Button size="sm" variant="outline" className="text-destructive border-destructive/40" disabled={!s.items.length || clearing} onClick={() => setConfirm(true)}>
          Remove all
        </Button>
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Devices</p>
        <DevicesList />
      </div>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove all downloads from this device?</AlertDialogTitle>
            <AlertDialogDescription>
              This frees up {formatBytes(onDevice)} here. Your downloads stay on your account, so you can restore them any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep them</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); clear(); }} disabled={clearing}>Remove all</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};

export default DownloadSettings;
