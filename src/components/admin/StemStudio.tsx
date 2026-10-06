import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Layers, Loader2, Play, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export type StemStatus = { status: "pending" | "processing" | "ready" | "failed"; error: string | null };

interface Summary {
  counts: Record<string, number>;
  missingTotal: number;
  notQueued: number;
  paused: string | null;
  rows: { song_id: string; status: StemStatus["status"]; error: string | null }[];
}

export async function callStemAdmin(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("stem-admin", { body });
  if (error) {
    const details = error instanceof FunctionsHttpError ? await error.context.text() : error.message;
    let msg = details;
    try { msg = JSON.parse(details).error ?? details; } catch { /* plain text */ }
    throw new Error(typeof msg === "string" ? msg : "Request failed");
  }
  return data;
}

export default function StemStudio({ onStatusChange, refreshKey = 0 }: { onStatusChange: (m: Record<string, StemStatus>) => void; refreshKey?: number }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = (await callStemAdmin({ action: "summary" })) as Summary;
      setSummary(s);
      const map: Record<string, StemStatus> = {};
      for (const r of s.rows) map[r.song_id] = { status: r.status, error: r.error };
      onStatusChange(map);
    } catch (e) {
      console.error("stem summary failed", e);
    }
  }, [onStatusChange]);

  useEffect(() => { load(); }, [load, refreshKey]);
  useEffect(() => {
    const active = (summary?.counts.pending ?? 0) + (summary?.counts.processing ?? 0) > 0;
    if (!active) return;
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [summary, load]);

  const processAll = async () => {
    if (!summary?.notQueued) return;
    if (!confirm(`Create karaoke tracks for ${summary.notQueued} song(s)? Each song uses a small amount of Replicate credit.`)) return;
    setBusy(true);
    try {
      const r = await callStemAdmin({ action: "enqueue_missing" });
      toast.success(`${r.queued} song(s) queued — tracks will appear over the next minutes`);
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    setBusy(false);
  };

  const resume = async () => {
    setBusy(true);
    try { await callStemAdmin({ action: "resume" }); toast.success("Resumed"); await load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    setBusy(false);
  };

  const c = summary?.counts ?? {};
  const stat = (label: string, value: number, cls: string) => (
    <div className="rounded-xl bg-muted/40 px-3 py-2 text-center">
      <p className={`text-lg font-bold ${cls}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );

  return (
    <div className="glass-card p-5 mb-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-gold" />
          <h3 className="font-serif font-bold text-foreground">Stem Studio</h3>
        </div>
        <button onClick={load} className="p-2 rounded-lg hover:bg-muted text-muted-foreground" aria-label="Refresh">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {stat("Ready", c.ready ?? 0, "text-gold")}
        {stat("Working", (c.pending ?? 0) + (c.processing ?? 0), "text-primary")}
        {stat("Failed", c.failed ?? 0, "text-destructive")}
        {stat("Missing", summary?.missingTotal ?? 0, "text-foreground")}
      </div>
      {summary?.paused && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-foreground flex items-center justify-between gap-3">
          <span>Paused: {summary.paused}</span>
          <Button size="sm" variant="outline" onClick={resume} disabled={busy}>Resume</Button>
        </div>
      )}
      <Button onClick={processAll} disabled={busy || !summary?.notQueued} className="gradient-gold text-primary-foreground gap-2 w-full">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
        {summary?.notQueued ? `Process all missing (${summary.notQueued})` : "All songs queued or ready"}
      </Button>
      <p className="text-[11px] text-muted-foreground">New songs with audio are queued automatically. Instrumentals you upload yourself are never replaced.</p>
    </div>
  );
}
