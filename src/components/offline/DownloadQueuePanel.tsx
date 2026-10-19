import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CloudDownload, HardDrive, MonitorSmartphone, Pause, Play, RotateCw, X, WifiOff, Music, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { useSecureDownloads } from "@/hooks/useSecureDownloads";
import { restoreAll, restoreLater, setPaused, setAllowCellular, retry, removeSecure } from "@/lib/secureDownloads/engine";
import { formatBytes, isMeteredConnection } from "@/lib/secureDownloads/policy";
import type { SecureItem } from "@/lib/secureDownloads/types";
import DevicesDialog from "./DevicesDialog";

const VISIBLE = 30;

const statusLabel = (i: SecureItem, pct: number | null, waiting: string | null) => {
  if (i.status === "locked") return "Premium is needed to keep this offline";
  if (i.status === "failed") return i.error || "Couldn't save — tap retry";
  if (i.status === "paused") return i.error || "Paused";
  if (i.status === "preparing") return "Preparing download…";
  if (i.status === "downloading" && pct !== null) return `Saving… ${pct}%`;
  if (waiting === "connection") return "Waiting for connection";
  if (waiting === "wifi" && i.source !== "user") return "Waiting for Wi-Fi";
  return "Waiting to save";
};

/** Downloads tab header: storage, restore from account, live queue and device management. */
const DownloadQueuePanel = () => {
  const s = useSecureDownloads();
  const navigate = useNavigate();
  const [devicesOpen, setDevicesOpen] = useState(false);
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);

  const readyCount = s.items.filter((i) => i.status === "ready").length;
  useEffect(() => {
    navigator.storage?.estimate?.().then((e) => setStorage({ usage: e.usage ?? 0, quota: e.quota ?? 0 })).catch(() => undefined);
  }, [readyCount]);

  const queue = useMemo(() => s.items
    .filter((i) => i.status !== "ready")
    .sort((a, b) => (a.songId === s.activeSongId ? -1 : b.songId === s.activeSongId ? 1 : a.priority - b.priority || b.addedAt - a.addedAt)),
  [s.items, s.activeSongId]);

  const savedBytes = s.items.filter((i) => i.status === "ready").reduce((n, i) => n + i.packages.reduce((m, p) => m + p.byteLength, 0), 0);
  const pending = queue.filter((i) => i.status !== "failed" && i.status !== "locked");
  const metered = isMeteredConnection((navigator as any).connection);
  const showRestore = !!s.restore && s.restore.songs.length > 0;

  return (
    <section className="mb-6 space-y-3" aria-label="Offline downloads on this device">
      <div className="rounded-2xl border border-border bg-card/60 backdrop-blur p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center"><HardDrive className="w-5 h-5 text-primary" /></div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Ready on this device</p>
            <p className="text-xs text-muted-foreground">
              {readyCount} {readyCount === 1 ? "song" : "songs"} · {formatBytes(savedBytes)}
              {storage?.quota ? ` · ${formatBytes(Math.max(0, storage.quota - storage.usage))} free` : ""}
            </p>
          </div>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setDevicesOpen(true)}>
            <MonitorSmartphone className="w-4 h-4" /> Devices
          </Button>
        </div>
        {storage?.quota ? (
          <Progress value={Math.min(100, (storage.usage / storage.quota) * 100)} className="h-1.5 mt-3" aria-label="Storage used on this device" />
        ) : null}
      </div>

      {showRestore && (
        <div className="rounded-2xl border border-primary/40 bg-primary/10 p-4">
          <div className="flex items-start gap-3">
            <CloudDownload className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {s.restore!.songs.length} saved {s.restore!.songs.length === 1 ? "song" : "songs"} from your account
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                About {formatBytes(s.restore!.bytes)}. Newest saves come first, and songs you play jump to the front.
                {metered ? " You're on mobile data — restoring waits for Wi-Fi unless you allow mobile data below." : ""}
              </p>
              <div className="flex gap-2 mt-3">
                <Button size="sm" className="gradient-gold text-primary-foreground" onClick={() => restoreAll()}>Restore all</Button>
                {s.restoreChoice !== "later" && <Button size="sm" variant="ghost" onClick={() => restoreLater()}>Later</Button>}
              </div>
            </div>
          </div>
        </div>
      )}

      {s.waitingFor === "space" && (
        <p className="rounded-xl bg-destructive/10 text-destructive text-xs px-3 py-2">
          This device is low on space. Remove some downloads, then tap retry.
        </p>
      )}
      {s.waitingFor === "connection" && pending.length > 0 && (
        <p className="rounded-xl bg-muted text-muted-foreground text-xs px-3 py-2 flex items-center gap-2">
          <WifiOff className="w-3.5 h-3.5" /> Waiting for connection — saving continues automatically.
        </p>
      )}

      {queue.length > 0 && (
        <div className="rounded-2xl border border-border bg-card/60 p-3">
          <div className="flex items-center justify-between px-1 pb-2">
            <p className="text-sm font-semibold text-foreground">Saving for offline · {pending.length}</p>
            {pending.length > 0 && (
              <Button size="sm" variant="ghost" className="gap-1.5 h-8" onClick={() => setPaused(!s.paused)}>
                {s.paused ? <><Play className="w-3.5 h-3.5" /> Resume</> : <><Pause className="w-3.5 h-3.5" /> Pause</>}
              </Button>
            )}
          </div>
          {pending.length > 0 && (
            <label className="flex items-center justify-between gap-3 px-1 pb-2 text-xs text-muted-foreground">
              Use mobile data for restoring
              <Switch checked={s.allowCellular} onCheckedChange={setAllowCellular} aria-label="Use mobile data for restoring" />
            </label>
          )}
          <ul className="space-y-1" aria-live="polite">
            {queue.slice(0, VISIBLE).map((i) => {
              const p = s.progress[i.songId];
              const pct = p && p.total ? Math.round((p.done / p.total) * 100) : null;
              const active = i.songId === s.activeSongId;
              return (
                <li key={i.songId} className="flex items-center gap-3 p-2 rounded-xl">
                  {i.meta.coverUrl
                    ? <img src={i.meta.coverUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
                    : <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center"><Music className="w-4 h-4 text-primary" /></div>}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{i.meta.title}</p>
                    <p className={`text-xs truncate ${i.status === "failed" || i.status === "locked" ? "text-destructive" : "text-muted-foreground"}`}>
                      {statusLabel(i, active ? pct : null, s.waitingFor)}
                    </p>
                    {active && pct !== null && <Progress value={pct} className="h-1 mt-1.5" aria-label={`Saving ${i.meta.title}`} />}
                  </div>
                  {i.status === "locked" ? (
                    <button onClick={() => navigate("/subscription")} className="p-2 rounded-lg text-primary hover:bg-primary/10" aria-label="Renew Premium">
                      <Lock className="w-4 h-4" />
                    </button>
                  ) : (i.status === "failed" || i.status === "paused") && (
                    <button onClick={() => retry(i.songId)} className="p-2 rounded-lg text-primary hover:bg-primary/10" aria-label={`Retry ${i.meta.title}`}>
                      <RotateCw className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => removeSecure(i.songId)} className="p-2 rounded-lg text-muted-foreground hover:bg-muted" aria-label={`Stop saving ${i.meta.title}`}>
                    <X className="w-4 h-4" />
                  </button>
                </li>
              );
            })}
          </ul>
          {queue.length > VISIBLE && <p className="text-xs text-muted-foreground px-1 pt-1">+{queue.length - VISIBLE} more waiting</p>}
        </div>
      )}

      <DevicesDialog open={devicesOpen} onOpenChange={setDevicesOpen} />
    </section>
  );
};

export default DownloadQueuePanel;
