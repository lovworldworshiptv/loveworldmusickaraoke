import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trophy, Plus, CheckCircle, XCircle, Play, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";

const AdminChallenges = () => {
  const { isAdmin, loading } = useIsAdmin();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    name: "", description: "", entry_fee: 1, prize_pool: 100,
    prize_dist: '{"1":70,"2":20,"3":10}',
    start_date: "", end_date: "", status: "draft",
    max_daily_scoring_games: "", max_referrals_per_user: 10, qualification_min_games: 10,
    allowed_subscriptions: ["free", "trial", "premium"] as string[],
    referral_gate_score: "" as string, referral_gate_required_invites: 3,
    difficulty_gates: [] as Array<{ min_score: number; max_score: number; allowed: string[] }>,
  });

  const { data: challenges = [] } = useQuery({
    queryKey: ["admin-challenges"],
    queryFn: async () => {
      const { data } = await supabase.from("challenges" as any).select("*").order("created_at", { ascending: false });
      return (data as any[]) || [];
    },
  });

  const { data: pendingEntries = [] } = useQuery({
    queryKey: ["admin-pending-entries"],
    queryFn: async () => {
      const { data } = await supabase
        .from("challenge_entries" as any)
        .select("*, challenges(name)")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      const rows = (data as any[]) || [];
      const ids = Array.from(new Set(rows.map((r) => r.user_id)));
      if (ids.length === 0) return rows;
      const { data: profs } = await supabase.from("profiles").select("user_id, username").in("user_id", ids);
      const map = new Map((profs || []).map((p: any) => [p.user_id, p.username]));
      return rows.map((r) => ({ ...r, _username: map.get(r.user_id) || null }));
    },
    refetchInterval: 30_000,
  });

  const openProof = async (path: string) => {
    const { data, error } = await supabase.storage.from("payment-proofs").createSignedUrl(path, 600);
    if (error || !data?.signedUrl) { toast.error(error?.message || "Could not open proof"); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const reviewPending = async (entry_id: string, action: "approve" | "reject") => {
    const { data, error } = await supabase.functions.invoke("approve-challenge-entry", { body: { entry_id, action } });
    if (error || (data as any)?.error) { toast.error((data as any)?.error || error?.message); return; }
    toast.success(`${action}d`);
    qc.invalidateQueries({ queryKey: ["admin-pending-entries"] });
    qc.invalidateQueries({ queryKey: ["admin-entries"] });
  };

  const removeEntry = async (entry_id: string) => {
    if (!confirm("Remove this user from the challenge? This deletes their entry and score.")) return;
    const { data, error } = await supabase.functions.invoke("approve-challenge-entry", { body: { entry_id, action: "remove" } });
    if (error || (data as any)?.error) { toast.error((data as any)?.error || error?.message); return; }
    toast.success("Removed");
    qc.invalidateQueries({ queryKey: ["admin-pending-entries"] });
    qc.invalidateQueries({ queryKey: ["admin-entries"] });
  };

  if (loading) return <AppLayout><div className="p-6 text-sm">Loading...</div></AppLayout>;
  if (!isAdmin) return <Navigate to="/" replace />;

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", description: "", entry_fee: 1, prize_pool: 100, prize_dist: '{"1":70,"2":20,"3":10}', start_date: "", end_date: "", status: "draft", max_daily_scoring_games: "", max_referrals_per_user: 10, qualification_min_games: 10, allowed_subscriptions: ["free","trial","premium"], referral_gate_score: "", referral_gate_required_invites: 3, difficulty_gates: [] });
    setShowForm(true);
  };

  const openEdit = (ch: any) => {
    setEditing(ch);
    setForm({
      name: ch.name, description: ch.description || "", entry_fee: ch.entry_fee, prize_pool: ch.prize_pool,
      prize_dist: JSON.stringify(ch.prize_distribution),
      start_date: ch.start_date.slice(0, 16), end_date: ch.end_date.slice(0, 16),
      status: ch.status, max_daily_scoring_games: ch.max_daily_scoring_games ?? "",
      max_referrals_per_user: ch.max_referrals_per_user ?? 10,
      qualification_min_games: ch.qualification_min_games,
      allowed_subscriptions: ch.allowed_subscriptions ?? ["free","trial","premium"],
      referral_gate_score: ch.referral_gate_score != null ? String(ch.referral_gate_score) : "",
      referral_gate_required_invites: ch.referral_gate_required_invites ?? 3,
      difficulty_gates: Array.isArray(ch.difficulty_gates) ? ch.difficulty_gates : [],
    });
    setShowForm(true);
  };

  const save = async () => {
    try {
      const payload: any = {
        name: form.name, description: form.description || null,
        entry_fee: Number(form.entry_fee), prize_pool: Number(form.prize_pool),
        prize_distribution: JSON.parse(form.prize_dist),
        start_date: new Date(form.start_date).toISOString(),
        end_date: new Date(form.end_date).toISOString(),
        status: form.status,
        max_daily_scoring_games: form.max_daily_scoring_games ? Number(form.max_daily_scoring_games) : null,
        max_referrals_per_user: form.max_referrals_per_user ? Number(form.max_referrals_per_user) : null,
        qualification_min_games: Number(form.qualification_min_games),
        allowed_subscriptions: form.allowed_subscriptions,
        referral_gate_score: form.referral_gate_score ? Number(form.referral_gate_score) : null,
        referral_gate_required_invites: Number(form.referral_gate_required_invites) || 0,
        difficulty_gates: (form.difficulty_gates || []).map(g => ({
          min_score: Number(g.min_score) || 0,
          max_score: Number(g.max_score) || 0,
          allowed: Array.isArray(g.allowed) ? g.allowed : [],
        })),
      };
      if (editing) {
        await supabase.from("challenges" as any).update(payload).eq("id", editing.id);
      } else {
        await supabase.from("challenges" as any).insert(payload);
      }
      toast.success("Saved");
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ["admin-challenges"] });
    } catch (e: any) { toast.error(e.message); }
  };

  const setStatus = async (id: string, status: string) => {
    await supabase.from("challenges" as any).update({ status }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-challenges"] });
  };

  const finalize = async (id: string) => {
    if (!confirm("Finalize this challenge and pay out prizes?")) return;
    const { data, error } = await supabase.functions.invoke("finalize-challenge", { body: { challenge_id: id } });
    if (error || (data as any)?.error) { toast.error((data as any)?.error || error?.message); return; }
    toast.success("Finalized");
    qc.invalidateQueries({ queryKey: ["admin-challenges"] });
  };

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 pb-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-serif font-bold flex items-center gap-2"><Trophy className="w-6 h-6 text-amber-400" /> Challenges</h1>
          <button onClick={openCreate} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm flex items-center gap-1"><Plus className="w-4 h-4" /> New</button>
        </div>

        {showForm && (
          <div className="glass-card p-5 mb-5 space-y-3">
            <h3 className="font-bold">{editing ? "Edit" : "New"} Challenge</h3>
            <Input label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Input label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Entry Fee (ESP) — 0 = Free" type="number" value={String(form.entry_fee)} onChange={(v) => setForm({ ...form, entry_fee: Number(v) })} />
              <Input label="Prize Pool (ESP)" type="number" value={String(form.prize_pool)} onChange={(v) => setForm({ ...form, prize_pool: Number(v) })} />
            </div>
            <Input label='Prize Distribution JSON (e.g. {"1":70,"2":20,"3":10})' value={form.prize_dist} onChange={(v) => setForm({ ...form, prize_dist: v })} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Start" type="datetime-local" value={form.start_date} onChange={(v) => setForm({ ...form, start_date: v })} />
              <Input label="End" type="datetime-local" value={form.end_date} onChange={(v) => setForm({ ...form, end_date: v })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Input label="Max daily games (blank=∞)" value={String(form.max_daily_scoring_games)} onChange={(v) => setForm({ ...form, max_daily_scoring_games: v })} />
              <Input label="Max referrals/user" type="number" value={String(form.max_referrals_per_user)} onChange={(v) => setForm({ ...form, max_referrals_per_user: Number(v) })} />
              <Input label="Min games to qualify" type="number" value={String(form.qualification_min_games)} onChange={(v) => setForm({ ...form, qualification_min_games: Number(v) })} />
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Who can enter this challenge?</p>
              <div className="flex flex-wrap gap-2">
                {(["free","trial","premium"] as const).map((tier) => {
                  const on = form.allowed_subscriptions.includes(tier);
                  return (
                    <button key={tier} type="button"
                      onClick={() => setForm({ ...form, allowed_subscriptions: on ? form.allowed_subscriptions.filter((t) => t !== tier) : [...form.allowed_subscriptions, tier] })}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize border ${on ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}>
                      {tier}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Selected tiers can enter. Leave all off to block entries.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input label="Milestone Advancement Score (blank = off)" type="number" value={form.referral_gate_score} onChange={(v) => setForm({ ...form, referral_gate_score: v })} />
              <Input label="Invites required at milestone" type="number" value={String(form.referral_gate_required_invites)} onChange={(v) => setForm({ ...form, referral_gate_required_invites: Number(v) })} />
            </div>
            <p className="text-[10px] text-muted-foreground -mt-1">When a player reaches this score, they must invite this many new players before more games count toward their score.</p>

            <p className="text-[10px] text-muted-foreground -mt-1">When a player reaches this score, they must invite this many new players before more games count toward their score.</p>

            <div className="pt-2 border-t border-border">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-xs font-semibold text-foreground">Difficulty Gates by Score Range</p>
                  <p className="text-[10px] text-muted-foreground">Restrict which difficulties count for score at different score bands. Add multiple rules; when none matches, all are open.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, difficulty_gates: [...form.difficulty_gates, { min_score: 0, max_score: 1000, allowed: ["easy","medium","hard"] }] })}
                  className="px-2.5 py-1.5 rounded-lg bg-primary/15 text-primary text-xs flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add rule
                </button>
              </div>
              <div className="space-y-2">
                {form.difficulty_gates.map((g, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-background/50 border border-border space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="text-[10px] text-muted-foreground">Min score</span>
                        <input type="number" value={g.min_score} onChange={(e) => {
                          const next = [...form.difficulty_gates];
                          next[idx] = { ...next[idx], min_score: Number(e.target.value) };
                          setForm({ ...form, difficulty_gates: next });
                        }} className="w-full mt-0.5 px-2 py-1.5 rounded bg-background border border-border text-xs" />
                      </label>
                      <label className="block">
                        <span className="text-[10px] text-muted-foreground">Max score</span>
                        <input type="number" value={g.max_score} onChange={(e) => {
                          const next = [...form.difficulty_gates];
                          next[idx] = { ...next[idx], max_score: Number(e.target.value) };
                          setForm({ ...form, difficulty_gates: next });
                        }} className="w-full mt-0.5 px-2 py-1.5 rounded bg-background border border-border text-xs" />
                      </label>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-1.5">
                        {(["easy","medium","hard"] as const).map(d => {
                          const on = g.allowed.includes(d);
                          return (
                            <button key={d} type="button" onClick={() => {
                              const next = [...form.difficulty_gates];
                              next[idx] = { ...next[idx], allowed: on ? g.allowed.filter(x => x !== d) : [...g.allowed, d] };
                              setForm({ ...form, difficulty_gates: next });
                            }} className={`px-2.5 py-1 rounded-full text-[10px] font-medium capitalize border ${on ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}>
                              {d}
                            </button>
                          );
                        })}
                      </div>
                      <button type="button" onClick={() => {
                        const next = form.difficulty_gates.filter((_, i) => i !== idx);
                        setForm({ ...form, difficulty_gates: next });
                      }} className="p-1.5 rounded bg-destructive/15 text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Score {g.min_score}–{g.max_score}: {g.allowed.length ? g.allowed.join(", ") : "no difficulties count"}
                    </p>
                  </div>
                ))}
                {form.difficulty_gates.length === 0 && (
                  <p className="text-[11px] text-muted-foreground italic">No difficulty gates — all difficulties count at every score.</p>
                )}
              </div>
            </div>

            <label className="block">
              <span className="text-xs text-muted-foreground">Status</span>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border text-sm">
                <option value="draft">Draft</option><option value="active">Active</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
              </select>
            </label>
            <div className="flex gap-2">
              <button onClick={save} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm">Save</button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border border-border text-sm">Cancel</button>
            </div>
          </div>
        )}

        {pendingEntries.length > 0 && (
          <div className="glass-card p-5 mb-5 border-amber-500/30">
            <h3 className="font-bold mb-3 flex items-center gap-2 text-amber-400">
              <CheckCircle className="w-4 h-4" /> Pending Entry Payments
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20">{pendingEntries.length}</span>
            </h3>
            <div className="space-y-2">
              {pendingEntries.map((e: any) => (
                <div key={e.id} className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-background/50 text-xs">
                  <div className="flex-1 min-w-[200px]">
                    <p className="font-semibold text-foreground text-sm">{e.full_name || e._username || "—"}</p>
                    <p className="text-muted-foreground">
                      {e._username && <span>@{e._username} · </span>}
                      {e.kingschat_username && <span>KC: {e.kingschat_username} · </span>}
                      {e.zone && <span>Zone: {e.zone} · </span>}
                      {e.challenges?.name || "Challenge"} · {Number(e.paid_amount)} ESP
                    </p>
                    <p className="text-muted-foreground/70 text-[10px] mt-0.5">
                      {new Date(e.created_at).toLocaleString()}
                    </p>
                  </div>
                  {e.payment_proof_url && (
                    <button onClick={() => openProof(e.payment_proof_url)} className="px-2.5 py-1 rounded bg-primary/15 text-primary text-xs">
                      View Proof
                    </button>
                  )}
                  <div className="flex gap-1">
                    <button onClick={() => reviewPending(e.id, "approve")} className="p-2 rounded bg-green-500/20 text-green-400" title="Approve"><CheckCircle className="w-4 h-4" /></button>
                    <button onClick={() => reviewPending(e.id, "reject")} className="p-2 rounded bg-destructive/20 text-destructive" title="Reject"><XCircle className="w-4 h-4" /></button>
                    <button onClick={() => removeEntry(e.id)} className="p-2 rounded bg-muted text-muted-foreground" title="Remove entry"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}


        <div className="space-y-3">
          {challenges.map((c: any) => (
            <ChallengeRow key={c.id} c={c} onEdit={openEdit} onStatus={setStatus} onFinalize={finalize} onOpenProof={openProof} onRemove={removeEntry} />
          ))}
          {challenges.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No challenges yet.</p>}
        </div>
      </div>
    </AppLayout>
  );
};

const Input = ({ label, value, onChange, type = "text" }: any) => (
  <label className="block">
    <span className="text-xs text-muted-foreground">{label}</span>
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border text-sm" />
  </label>
);

const ChallengeRow = ({ c, onEdit, onStatus, onFinalize, onOpenProof, onRemove }: any) => {
  const qc = useQueryClient();
  const [showEntries, setShowEntries] = useState(false);
  const { data: entries = [] } = useQuery({
    queryKey: ["admin-entries", c.id, showEntries],
    queryFn: async () => {
      if (!showEntries) return [];
      const { data } = await supabase.from("challenge_entries" as any)
        .select("*").eq("challenge_id", c.id).order("created_at", { ascending: false });
      const rows = (data as any[]) || [];
      const ids = Array.from(new Set(rows.map((r) => r.user_id)));
      if (ids.length === 0) return rows;
      const { data: profs } = await supabase.from("profiles").select("user_id, username").in("user_id", ids);
      const map = new Map((profs || []).map((p: any) => [p.user_id, p.username]));
      return rows.map((r) => ({ ...r, _username: map.get(r.user_id) || null }));
    },
    enabled: showEntries,
  });

  const review = async (entry_id: string, action: "approve" | "reject") => {
    const { data, error } = await supabase.functions.invoke("approve-challenge-entry", { body: { entry_id, action } });
    if (error || (data as any)?.error) { toast.error((data as any)?.error || error?.message); return; }
    toast.success(`${action}d`);
    qc.invalidateQueries({ queryKey: ["admin-entries", c.id] });
  };

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold">{c.name}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full ${c.status === "active" ? "bg-green-500/20 text-green-400" : c.status === "completed" ? "bg-blue-500/20 text-blue-400" : "bg-muted text-muted-foreground"}`}>{c.status}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {new Date(c.start_date).toLocaleDateString()} → {new Date(c.end_date).toLocaleDateString()} · Fee {Number(c.entry_fee) <= 0 ? "Free" : `${c.entry_fee} ESP`} · Pool {c.prize_pool} ESP
          </p>
        </div>
        <div className="flex gap-1">
          <button onClick={() => onEdit(c)} className="px-3 py-1.5 rounded-lg border border-border text-xs">Edit</button>
          {c.status === "draft" && <button onClick={() => onStatus(c.id, "active")} className="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-xs flex items-center gap-1"><Play className="w-3 h-3" /> Activate</button>}
          {c.status === "active" && <button onClick={() => onFinalize(c.id)} className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 text-xs flex items-center gap-1"><Square className="w-3 h-3" /> Finalize</button>}
        </div>
      </div>
      <button onClick={() => setShowEntries(!showEntries)} className="text-xs text-primary">{showEntries ? "Hide" : "Show"} entries</button>
      {showEntries && (
        <div className="mt-3 space-y-1.5">
          {entries.map((e: any) => (
            <div key={e.id} className="flex items-center justify-between gap-2 p-2 rounded bg-background/50 text-xs">
              <div className="flex-1 truncate">
                <span className="font-medium">{e.full_name || e._username || "—"}</span>
                {e._username && <span className="ml-1 text-muted-foreground">@{e._username}</span>}
                {e.zone && <span className="ml-2 text-muted-foreground">· {e.zone}</span>}
                <span className={`ml-2 px-1.5 py-0.5 rounded ${e.status === "approved" ? "bg-green-500/20 text-green-400" : e.status === "pending" ? "bg-amber-500/20 text-amber-400" : "bg-destructive/20 text-destructive"}`}>{e.status}</span>
                {e.is_premium_free && <span className="ml-2 text-amber-400">Premium Free</span>}
                {e.payment_proof_url && <button onClick={() => onOpenProof(e.payment_proof_url)} className="ml-2 text-primary underline">proof</button>}
              </div>
              {e.status === "pending" && (
                <>
                  <button onClick={() => review(e.id, "approve")} className="p-1.5 rounded bg-green-500/20 text-green-400"><CheckCircle className="w-3.5 h-3.5" /></button>
                  <button onClick={() => review(e.id, "reject")} className="p-1.5 rounded bg-destructive/20 text-destructive"><XCircle className="w-3.5 h-3.5" /></button>
                </>
              )}
              <button
                onClick={async () => {
                  await onRemove(e.id);
                  qc.invalidateQueries({ queryKey: ["admin-entries", c.id] });
                }}
                className="p-1.5 rounded bg-muted text-muted-foreground"
                title="Remove from challenge"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {entries.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">No entries</p>}
        </div>
      )}
    </div>
  );
};

export default AdminChallenges;
