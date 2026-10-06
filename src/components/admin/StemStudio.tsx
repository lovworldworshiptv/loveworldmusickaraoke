import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Bell, CheckCheck, Layers, Loader2, Play, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export type StemStatus = { status: "pending" | "processing" | "ready" | "failed"; error: string | null };

interface JobRow {
  song_id: string;
  status: StemStatus["status"];
  error: string | null;
  attempts: number;
  started_at: string | null;
  updated_at: string | null;
  songs: { title: string } | null;
}

interface Summary {
  counts: Record<string, number>;
  missingTotal: number;
  notQueued: number;
  paused: string | null;
  rows: JobRow[];
}

interface AdminNotification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  is_read: boolean;
  created_at: string;
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

const timeAgo = (iso: string | null) => {
  if (!iso) return "";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const statusChip = (status: StemStatus["status"]) => {
  const map: Record<string, string> = {
    pending: "bg-muted text-muted-foreground",
    processing: "bg-primary/15 text-primary",
    ready: "bg-gold/15 text-gold",
    failed: "bg-destructive/15 text-destructive",
  };
  return map[status] ?? map.pending;
};

export default function StemStudio({ onStatusChange, refreshKey = 0 }: { onStatusChange: (m: Record<string, StemStatus>) => void; refreshKey?: number }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [notes, setNotes] = useState<AdminNotification[]>([]);
  const [showNotes, setShowNotes] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadNotes = useCallback(async () => {
    const { data } = await supabase
      .from("admin_notifications")
      .select("id, type, title, message, is_read, created_at")
      .like("type", "stem_%")
      .order("created_at", { ascending: false })
      .limit(20);
    setNotes((data as AdminNotification[]) ?? []);
  }, []);

  const load = useCallback(async () => {
    try {
      const s = (await callStemAdmin({ action: "summary" })) as Summary;
      setSummary(s);
      const map: Record<string, StemStatus> = {};
      for (const r of s.rows) map[r.song_id] = { status: r.status, error: r.error };
      onStatusChange(map);
      await loadNotes();
    } catch (e) {
      console.error("stem summary failed", e);
    }
  }, [onStatusChange, loadNotes]);

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

  const markAllRead = async () => {
    const unread = notes.filter((n) => !n.is_read).map((n) => n.id);
    if (!unread.length) return;
    await supabase.from("admin_notifications").update({ is_read: true }).in("id", unread);
    await loadNotes();
  };

  const unreadCount = notes.filter((n) => !n.is_read).length;
  const activeJobs = (summary?.rows ?? []).filter((r) => r.status === "pending" || r.status === "processing");
  const recentJobs = (summary?.rows ?? []).filter((r) => r.status === "ready" || r.status === "failed").slice(0, 8);

  const c = summary?.counts ?? {};
  const stat = (label: string, value: number, cls: string) => (
    <div className="rounded-xl bg-muted/40 px-3 py-2 text-center">
      <p className={`text-lg font-bold ${cls}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );

  const jobRow = (r: JobRow) => (
    <div key={`${r.song_id}-${r.status}`} className="flex items-center justify-between gap-3 rounded-lg bg-muted/30 px-3 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{r.songs?.title ?? "Unknown song"}</p>
        {r.error && <p className="text-[11px] text-destructive truncate">{r.error}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[10px] text-muted-foreground">{timeAgo(r.status === "processing" ? r.started_at : r.updated_at)}</span>
        <span className={`text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${statusChip(r.status)}`}>{r.status}</span>
      </div>
    </div>
  );

  return (
    <div className="glass-card p-5 mb-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-gold" />
          <h3 className="font-serif font-bold text-foreground">Stem Studio</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setShowNotes((v) => !v); if (!showNotes) markAllRead(); }}
            className="relative p-2 rounded-lg hover:bg-muted text-muted-foreground"
            aria-label="Stem notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>
          <button onClick={load} className="p-2 rounded-lg hover:bg-muted text-muted-foreground" aria-label="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showNotes && (
        <div className="rounded-xl border border-border bg-card/60 divide-y divide-border max-h-64 overflow-y-auto">
          {notes.length === 0 && <p className="text-xs text-muted-foreground p-3">No stem activity yet.</p>}
          {notes.map((n) => (
            <div key={n.id} className="px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-foreground">{n.title}</p>
                <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(n.created_at)}</span>
              </div>
              {n.message && <p className="text-[11px] text-muted-foreground mt-0.5">{n.message}</p>}
            </div>
          ))}
          {notes.length > 0 && (
            <button onClick={markAllRead} className="w-full flex items-center justify-center gap-1 py-2 text-[11px] text-muted-foreground hover:text-foreground">
              <CheckCheck className="w-3 h-3" /> Mark all read
            </button>
          )}
        </div>
      )}

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

      {activeJobs.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Being processed</p>
          {activeJobs.map(jobRow)}
        </div>
      )}

      {recentJobs.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Recent</p>
          {recentJobs.map(jobRow)}
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
