import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Users, Music, Play, Download, Heart, TrendingUp, Calendar, Crown, Mic2, Gamepad2, BookOpen, Trophy } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";

const COLORS = ["hsl(43 70% 53%)", "hsl(258 70% 55%)", "hsl(170 60% 45%)", "hsl(350 65% 55%)", "hsl(210 60% 50%)"];

const StatCard = ({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string | number; sub?: string }) => (
  <div className="rounded-xl border border-border bg-card p-4 space-y-1">
    <div className="flex items-center gap-2 text-muted-foreground">
      <Icon className="w-4 h-4" />
      <span className="text-xs font-medium">{label}</span>
    </div>
    <p className="text-2xl font-bold text-foreground">{value}</p>
    {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
  </div>
);

const AdminAnalytics = () => {
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [range, setRange] = useState<"7d" | "30d" | "all">("30d");

  const rangeDate = range === "7d"
    ? new Date(Date.now() - 7 * 86400000).toISOString()
    : range === "30d"
    ? new Date(Date.now() - 30 * 86400000).toISOString()
    : "2000-01-01T00:00:00Z";

  // Total users
  const { data: totalUsers = 0 } = useQuery({
    queryKey: ["analytics-total-users"],
    enabled: isAdmin,
    queryFn: async () => {
      const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true });
      return count || 0;
    },
  });

  // Total songs
  const { data: totalSongs = 0 } = useQuery({
    queryKey: ["analytics-total-songs"],
    enabled: isAdmin,
    queryFn: async () => {
      const { count } = await supabase.from("songs").select("id", { count: "exact", head: true });
      return count || 0;
    },
  });

  // Total plays (recently_played count)
  const { data: totalPlays = 0 } = useQuery({
    queryKey: ["analytics-total-plays", range],
    enabled: isAdmin,
    queryFn: async () => {
      const { count } = await supabase.from("recently_played").select("id", { count: "exact", head: true }).gte("played_at", rangeDate);
      return count || 0;
    },
  });

  // Total favorites
  const { data: totalFavorites = 0 } = useQuery({
    queryKey: ["analytics-total-favorites"],
    enabled: isAdmin,
    queryFn: async () => {
      const { count } = await supabase.from("favorites").select("id", { count: "exact", head: true });
      return count || 0;
    },
  });

  // Total downloads
  const { data: totalDownloads = 0 } = useQuery({
    queryKey: ["analytics-total-downloads"],
    enabled: isAdmin,
    queryFn: async () => {
      const { count } = await supabase.from("downloads").select("id", { count: "exact", head: true });
      return count || 0;
    },
  });

  // Total karaoke recordings
  const { data: totalKaraoke = 0 } = useQuery({
    queryKey: ["analytics-total-karaoke"],
    enabled: isAdmin,
    queryFn: async () => {
      const { count } = await supabase.from("karaoke_recordings").select("id", { count: "exact", head: true });
      return count || 0;
    },
  });

  // Role distribution
  const { data: roleData = [] } = useQuery({
    queryKey: ["analytics-roles"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role");
      if (!data) return [];
      const counts: Record<string, number> = {};
      data.forEach(r => { counts[r.role] = (counts[r.role] || 0) + 1; });
      return Object.entries(counts).map(([name, value]) => ({ name, value }));
    },
  });

  // Subscription distribution
  const { data: subData = [] } = useQuery({
    queryKey: ["analytics-subscriptions"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("user_subscriptions").select("subscription, subscription_expiry_date");
      if (!data) return [];
      const counts: Record<string, number> = {};
      data.forEach((s: any) => {
        const isExpired = s.subscription_expiry_date && new Date(s.subscription_expiry_date) < new Date();
        const effective = (s.subscription === "premium" || s.subscription === "trial") && isExpired ? "free" : s.subscription;
        counts[effective] = (counts[effective] || 0) + 1;
      });
      return Object.entries(counts).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));
    },
  });

  // Top played songs
  const { data: topSongs = [] } = useQuery({
    queryKey: ["analytics-top-songs", range],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("recently_played").select("song_id, songs(title)").gte("played_at", rangeDate).limit(1000);
      if (!data) return [];
      const counts: Record<string, { title: string; count: number }> = {};
      data.forEach((r: any) => {
        const id = r.song_id;
        if (!counts[id]) counts[id] = { title: r.songs?.title || "Unknown", count: 0 };
        counts[id].count++;
      });
      return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 10);
    },
  });

  // Plays per day (last 30 days)
  const { data: playsPerDay = [] } = useQuery({
    queryKey: ["analytics-plays-per-day"],
    enabled: isAdmin,
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data } = await supabase.from("recently_played").select("played_at").gte("played_at", since).order("played_at").limit(1000);
      if (!data) return [];
      const days: Record<string, number> = {};
      data.forEach(r => {
        const day = r.played_at.slice(0, 10);
        days[day] = (days[day] || 0) + 1;
      });
      return Object.entries(days).map(([date, plays]) => ({ date: date.slice(5), plays }));
    },
  });

  // New users per day (last 30 days)
  const { data: newUsersPerDay = [] } = useQuery({
    queryKey: ["analytics-new-users-per-day"],
    enabled: isAdmin,
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data } = await supabase.from("profiles").select("created_at").gte("created_at", since).order("created_at").limit(1000);
      if (!data) return [];
      const days: Record<string, number> = {};
      data.forEach(r => {
        const day = r.created_at.slice(0, 10);
        days[day] = (days[day] || 0) + 1;
      });
      return Object.entries(days).map(([date, users]) => ({ date: date.slice(5), users }));
    },
  });

  // Top categories
  const { data: topCategories = [] } = useQuery({
    queryKey: ["analytics-top-categories"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data } = await supabase.from("songs").select("category_id, categories(name)").not("category_id", "is", null);
      if (!data) return [];
      const counts: Record<string, { name: string; count: number }> = {};
      data.forEach((s: any) => {
        const id = s.category_id;
        if (!counts[id]) counts[id] = { name: s.categories?.name || "Unknown", count: 0 };
        counts[id].count++;
      });
      return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 5);
    },
  });

  // Total articles
  const { data: totalArticles = 0 } = useQuery({
    queryKey: ["analytics-total-articles"],
    enabled: isAdmin,
    queryFn: async () => {
      const { count } = await supabase.from("articles").select("id", { count: "exact", head: true });
      return count || 0;
    },
  });

  // Total feedback
  const { data: totalFeedback = 0 } = useQuery({
    queryKey: ["analytics-total-feedback"],
    enabled: isAdmin,
    queryFn: async () => {
      const { count } = await supabase.from("feedback").select("id", { count: "exact", head: true });
      return count || 0;
    },
  });

  if (adminLoading) return <AppLayout><div className="p-6 text-center text-muted-foreground">Loading...</div></AppLayout>;
  if (!isAdmin) return <AppLayout><div className="p-6 text-center text-muted-foreground">Admin access required.</div></AppLayout>;

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 lg:pt-6 max-w-6xl pb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-serif font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-gold" /> Analytics
          </h2>
          <div className="flex gap-1 bg-muted rounded-lg p-0.5">
            {(["7d", "30d", "all"] as const).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {r === "7d" ? "7 Days" : r === "30d" ? "30 Days" : "All Time"}
              </button>
            ))}
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <StatCard icon={Users} label="Total Users" value={totalUsers} />
          <StatCard icon={Music} label="Total Songs" value={totalSongs} />
          <StatCard icon={Play} label="Total Plays" value={totalPlays} sub={range === "all" ? "all time" : `last ${range}`} />
          <StatCard icon={Heart} label="Total Favorites" value={totalFavorites} />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <StatCard icon={Download} label="Total Downloads" value={totalDownloads} />
          <StatCard icon={Mic2} label="Karaoke Recordings" value={totalKaraoke} />
          <StatCard icon={Crown} label="Total Feedback" value={totalFeedback} />
          <StatCard icon={TrendingUp} label="Total Articles" value={totalArticles} />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Plays per day */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-gold" /> Plays (Last 30 Days)
            </h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={playsPerDay}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="plays" fill="hsl(43 70% 53%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* New users per day */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gold" /> New Users (Last 30 Days)
            </h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={newUsersPerDay}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="users" stroke="hsl(258 70% 55%)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Second row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Role distribution */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-gold" /> User Roles
            </h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={roleData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                    {roleData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Subscription distribution */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Crown className="w-4 h-4 text-gold" /> Subscription Tiers
            </h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={subData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                    {subData.map((_, i) => <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top played songs */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Music className="w-4 h-4 text-gold" /> Top Played Songs
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-hide">
              {topSongs.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No play data yet</p>
              ) : topSongs.map((s, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="w-5 text-right text-xs font-bold text-gold">{i + 1}</span>
                  <div className="flex-1 min-w-0 truncate text-foreground">{s.title}</div>
                  <span className="text-xs text-muted-foreground tabular-nums">{s.count} plays</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Category stats + summary */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-4">Songs by Category</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topCategories} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={80} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" fill="hsl(170 60% 45%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-4">Platform Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Songs</span>
                <span className="font-semibold text-foreground">{totalSongs}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Articles</span>
                <span className="font-semibold text-foreground">{totalArticles}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Users</span>
                <span className="font-semibold text-foreground">{totalUsers}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Plays ({range})</span>
                <span className="font-semibold text-foreground">{totalPlays}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Favorites</span>
                <span className="font-semibold text-foreground">{totalFavorites}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Downloads</span>
                <span className="font-semibold text-foreground">{totalDownloads}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Karaoke Recordings</span>
                <span className="font-semibold text-foreground">{totalKaraoke}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">User Feedback</span>
                <span className="font-semibold text-foreground">{totalFeedback}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default AdminAnalytics;
