import { useCallback, useEffect, useState } from "react";
import { Laptop, Smartphone, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { listDevices, revokeDevice } from "@/lib/secureDownloads/engine";
import type { DeviceInfo } from "@/lib/secureDownloads/types";

interface Props { open: boolean; onOpenChange: (o: boolean) => void; limitReached?: boolean }

const ago = (iso: string) => {
  const d = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
  return d <= 0 ? "Active today" : d === 1 ? "Active yesterday" : `Active ${d} days ago`;
};

/** Devices that can keep songs for offline listening (five per account). */
const DevicesDialog = ({ open, onOpenChange, limitReached }: Props) => {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [limit, setLimit] = useState(5);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listDevices();
      setDevices(res.devices);
      setLimit(res.limit);
      setCurrentId(res.currentId);
    } catch {
      toast.error("Couldn't load your devices. Check your connection.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (open) load(); }, [open, load]);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Your offline devices</DialogTitle>
          <DialogDescription>
            {limitReached
              ? `You can keep offline songs on up to ${limit} devices. Remove one to save songs here.`
              : `Songs you save play offline on up to ${limit} devices. Removing a device clears its offline songs.`}
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : devices.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No devices yet — save a song to add this one.</p>
        ) : (
          <ul className="space-y-2">
            {devices.map((d) => {
              const Icon = /iPhone|Android|iPad/.test(d.label) ? Smartphone : Laptop;
              return (
                <li key={d.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center"><Icon className="w-5 h-5 text-primary" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {d.label}{d.id === currentId && <span className="ml-2 text-[10px] rounded-full bg-primary/20 text-primary px-2 py-0.5 align-middle">This device</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">{ago(d.last_active_at)}</p>
                  </div>
                  <Button size="sm" variant="outline" disabled={removing === d.id} onClick={() => remove(d)}>
                    {removing === d.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Remove"}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DevicesDialog;
