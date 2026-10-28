import { useEffect, useMemo, useState } from "react";
import { Search, Crown, Clock, User } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAll";
import { effectiveSubscription, TIER_FILTERS, matchesTierFilter, countTierFilters, type TierFilterKey } from "@/lib/adminUsers";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

interface SubscriberRow {
  user_id: string;
  username: string;
  avatar_url: string | null;
  kingschat_handle: string | null;
  email: string | null;
  subscription: string;
  subscription_plan: string | null;
  start: string | null;
  expiry: string | null;
}

const PLAN_NAMES: Record<string, string> = {
  "1_month": "1 month",
  "3_months": "3 months",
  "6_months": "6 months",
  "1_year": "1 year",
  "3_day_trial": "3-day trial",
};

const PAGE = 100;
const DAY = 86_400_000;

function tierLabel(u: SubscriberRow) {
  if (u.subscription === "premium") return `Premium${u.subscription_plan && PLAN_NAMES[u.subscription_plan] ? ` · ${PLAN_NAMES[u.subscription_plan]}` : ""}`;
  if (u.subscription === "trial") return "Free trial";
  return "Free";
}

function TierIcon({ sub }: { sub: string }) {
  if (sub === "premium") return <Crown className="w-3.5 h-3.5 text-gold" />;
  if (sub === "trial") return <Clock className="w-3.5 h-3.5 text-primary" />;
  return <User className="w-3.5 h-3.5 text-muted-foreground" />;
}

const SubscriberTiers = ({ onSelectUser }: { onSelectUser: (userId: string) => void }) => {
  const [users, setUsers] = useState<SubscriberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TierFilterKey>("premium");
  const [search, setSearch] = useState("");
  const [shown, setShown] = useState(PAGE);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Load every page: the backend returns at most 1,000 rows per request.
        const [profiles, subs] = await Promise.all([
          fetchAllRows((from, to) => supabase.from("profiles")
            .select("user_id, username, avatar_url, kingschat_handle, email")
            .order("created_at", { ascending: false }).order("id").range(from, to)),
          fetchAllRows((from, to) => supabase.from("user_subscriptions")
            .select("user_id, subscription, subscription_plan, subscription_start_date, subscription_expiry_date")
            .order("id").range(from, to)),
        ]);
        const subMap = new Map<string, any>();
        subs.forEach((s: any) => subMap.set(s.user_id, s));
        const rows: SubscriberRow[] = profiles.map((p: any) => {
          const s = subMap.get(p.user_id);
          const sub = s ? effectiveSubscription(s.subscription, s.subscription_expiry_date) : "free";
          const active = sub !== "free";
          return {
            user_id: p.user_id,
            username: p.username || "Unnamed",
            avatar_url: p.avatar_url,
            kingschat_handle: p.kingschat_handle,
            email: p.email,
            subscription: sub,
            subscription_plan: active ? s?.subscription_plan ?? null : null,
            start: active ? s?.subscription_start_date ?? null : null,
            expiry: active ? s?.subscription_expiry_date ?? null : null,
          };
        });
        if (!cancelled) setUsers(rows);
      } catch {
        if (!cancelled) toast.error("Failed to load subscribers");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { setShown(PAGE); }, [filter, search]);

  const counts = useMemo(() => countTierFilters(users), [users]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = users.filter((u) => matchesTierFilter(u, filter)).filter((u) =>
      !q || u.username.toLowerCase().includes(q) ||
      (u.kingschat_handle || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q)
    );
    // Paid and trial plans: soonest to run out first.
    return list.sort((a, b) => {
      if (!a.expiry && !b.expiry) return 0;
      if (!a.expiry) return 1;
      if (!b.expiry) return -1;
      return new Date(a.expiry).getTime() - new Date(b.expiry).getTime();
    });
  }, [users, filter, search]);

  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" }) : "—";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by subscription">
        {TIER_FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              aria-pressed={active}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${active ? "gradient-gold text-primary-foreground border-transparent" : "bg-muted text-foreground border-border hover:border-gold/50"}`}
            >
              {f.label}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? "bg-background/20" : "bg-background text-muted-foreground"}`}>
                {loading ? "…" : counts[f.key]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text" placeholder="Search by name, email, or KingsChat handle..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm text-center py-12">Loading subscribers...</p>
      ) : (
        <div className="glass-card overflow-hidden">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No one in this group</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Expires</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, shown).map((u) => {
                  const daysLeft = u.expiry ? Math.max(0, Math.ceil((new Date(u.expiry).getTime() - Date.now()) / DAY)) : null;
                  return (
                    <TableRow key={u.user_id} className="cursor-pointer" onClick={() => onSelectUser(u.user_id)}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-foreground">
                              {u.username.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{u.username}</p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {u.kingschat_handle ? `@${u.kingschat_handle}` : u.email || ""}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5 text-xs text-foreground whitespace-nowrap">
                          <TierIcon sub={u.subscription} /> {tierLabel(u)}
                        </span>
                      </TableCell>
                      <TableCell><span className="text-xs text-muted-foreground whitespace-nowrap">{fmt(u.start)}</span></TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {fmt(u.expiry)}
                          {daysLeft !== null && <span className="block text-[10px] text-gold">{daysLeft} day{daysLeft === 1 ? "" : "s"} left</span>}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          {filtered.length > shown && (
            <div className="p-3 text-center border-t border-border">
              <Button variant="outline" size="sm" onClick={() => setShown((n) => n + PAGE)}>
                Show more ({filtered.length - shown} left)
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SubscriberTiers;
