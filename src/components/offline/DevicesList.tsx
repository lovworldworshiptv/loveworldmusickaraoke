import { useCallback, useEffect, useState } from "react";
import { Laptop, Smartphone, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listDevices, revokeDevice } from "@/lib/secureDownloads/engine";
import type { DeviceInfo } from "@/lib/secureDownloads/types";

const ago = (iso: string) => {
  const d = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
  return d <= 0 ? "Active today" : d === 1 ? "Active yesterday" : `Active ${d} days ago`;
};

/** Devices that keep offline songs for this account, each with Remove. */
const DevicesList = ({ onLimit }: { onLimit?: (limit: number) => void }) => {
  const [devices, setDevices] = useState<DeviceInfo[] | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await listDevices();
      setDevices(res.devices);
      setCurrentId(res.currentId);
      onLimit?.(res.limit);
    } catch {
      setDevices([]);
      toast.error("Couldn't load your devices. Check your connection.");
    }
  }, [onLimit]);

  useEffect(() => { load(); }, [load]);

  const remove = async (d: DeviceInfo) => {
    setRemoving(d.id);
    try {
      await revokeDevice(d.id);
      toast.success(d.id === currentId ? "Offline songs removed from this device" : `${d.label} removed`);
      await load();
    } catch {
      toast.error("Couldn't remove that device. Try again.");
    } finally { setRemoving(null); }
  };

  if (!devices) {
    return (
      <ul className="space-y-2" aria-busy="true" aria-label="Loading your devices">
        {[0, 1].map((k) => (
          <li key={k} className="flex items-center gap-3 rounded-2xl border border-border p-3">
            <Skeleton className="w-10 h-10 rounded-xl" />
            <div className="flex-1 space-y-1.5"><Skeleton className="h-3.5 w-32" /><Skeleton className="h-3 w-20" /></div>
          </li>
        ))}
      </ul>
    );
  }
  if (!devices.length) return <p className="text-sm text-muted-foreground py-4 text-center">No devices yet — save a song to add this one.</p>;

  return (
    <ul className="space-y-2">
      {devices.map((d) => {
        const Icon = /iPhone|Android|iPad/.test(d.label) ? Smartphone : Laptop;
        return (
          <li key={d.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center"><Icon className="w-5 h-5 text-offline-accent" aria-hidden="true" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">
                {d.label}{d.id === currentId && <span className="ml-2 text-[10px] rounded-full bg-primary/20 text-foreground px-2 py-0.5 align-middle">This device</span>}
              </p>
              <p className="text-xs text-muted-foreground">{ago(d.last_active_at)}</p>
            </div>
            <Button size="sm" variant="outline" disabled={removing === d.id} onClick={() => remove(d)} aria-label={`Remove ${d.label}${d.id === currentId ? " (this device)" : ""}`}>
              {removing === d.id ? <Loader2 className="w-4 h-4 motion-safe:animate-spin" aria-hidden="true" /> : "Remove"}
            </Button>
          </li>
        );
      })}
    </ul>
  );
};

export default DevicesList;
