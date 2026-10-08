import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { summarizeOnboarding, type OnboardingStats } from "@/lib/onboardingAnalytics";

const RANGES = [7, 30, 90];

const OnboardingInsights = ({ titles }: { titles: string[] }) => {
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState<OnboardingStats | null>(null);

  useEffect(() => {
    setStats(null);
    const since = new Date(Date.now() - days * 86400000).toISOString();
    supabase.from("analytics_events").select("event_type, event_data")
      .in("event_type", ["onboarding_view", "onboarding_skip", "onboarding_complete", "onboarding_leave"])
      .gte("created_at", since).limit(10000)
      .then(({ data }) => setStats(summarizeOnboarding(data || [])));
  }, [days]);

  const pct = (n: number) => (stats?.started ? `${Math.round((n / stats.started) * 100)}%` : "0%");
  const maxViews = Math.max(1, ...(stats?.perScreen.map((p) => p.views) ?? [1]));

  return (
    <section aria-label="Onboarding insights" className="glass-card p-5 mb-6 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-serif font-bold text-foreground">Onboarding insights</h3>
        <div className="flex gap-1">
          {RANGES.map((d) => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-3 py-1 rounded-full text-xs ${d === days ? "gradient-gold text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{d} days</button>
          ))}
        </div>
      </div>
      {!stats ? <p role="status" className="text-sm text-muted-foreground">Loading…</p> : stats.started === 0 ? (
        <p className="text-sm text-muted-foreground">No onboarding activity in this period yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Started", value: String(stats.started) },
              { label: "Completed", value: `${stats.completed} · ${pct(stats.completed)}` },
              { label: "Skipped", value: `${stats.skipped} · ${pct(stats.skipped)}` },
              { label: "Left the app", value: `${stats.left} · ${pct(stats.left)}` },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-muted/50 p-3">
                <p className="text-lg font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
          <ul className="space-y-2">
            {stats.perScreen.map((p) => (
              <li key={p.index} className="text-sm">
                <div className="flex justify-between gap-2 mb-1">
                  <span className="text-foreground truncate">{p.index + 1}. {titles[p.index] ?? "Screen"}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{p.views} views · {p.skips} skipped · {p.leaves} left</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full gradient-gold" style={{ width: `${(p.views / maxViews) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
};

export default OnboardingInsights;
