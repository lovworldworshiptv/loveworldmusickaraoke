import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Activity, AlertTriangle, BarChart3, BookOpen, CheckCircle2, Clock3, Crown,
  Download, Gamepad2, Share2, UserPlus, Heart, MapPin, Mic2, Music, Play, RefreshCw, Users,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { supabase } from "@/integrations/supabase/client";
import { CHANNEL_LABELS } from "@/lib/acquisitionAnalytics";

type Range = "7d" | "30d" | "all";
type Song = {
  id: string; title: string; artist: string; cover_url: string | null; audio_url: string | null;
  instrumental_url: string | null; lyrics_lrc: string | null; lyrics_text: string | null;
  category_id: string | null; has_video: boolean; is_featured: boolean;
};
type PlayEvent = { user_id: string | null; song_id: string; mode: string; created_at: string };

const panel = "rounded-xl border border-border bg-card p-4";
const tooltipStyle = { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 };

const StatCard = ({ icon: Icon, label, value, sub }: { icon: typeof Users; label: string; value: string | number; sub?: string }) => (
  <div className={panel}>
    <div className="flex items-center gap-2 text-muted-foreground"><Icon className="h-4 w-4" /><span className="text-xs font-medium">{label}</span></div>
    <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
    {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
  </div>
);

const empty = (message: string) => <p className="py-8 text-center text-sm text-muted-foreground">{message}</p>;

const AdminAnalytics = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [range, setRange] = useState<Range>("30d");

  const analytics = useQuery({
    queryKey: ["admin-v2-dashboard"],
    enabled: isAdmin,
    queryFn: async () => {
      const results = await Promise.all([
        supabase.from("profiles").select("user_id, username, avatar_url, region, zone, created_at, profile_completed").order("created_at", { ascending: false }),
        supabase.from("songs").select("id, title, artist, cover_url, audio_url, instrumental_url, lyrics_lrc, lyrics_text, category_id, has_video, is_featured").order("title"),
        supabase.from("play_events").select("user_id, song_id, mode, created_at").order("created_at", { ascending: false }).limit(5000),
        supabase.from("favorites").select("user_id, song_id").limit(5000),
        supabase.from("downloads").select("user_id, song_id").limit(5000),
        supabase.from("karaoke_recordings").select("user_id, song_id, created_at").limit(5000),
        supabase.from("user_subscriptions").select("user_id, subscription, subscription_expiry_date"),
        supabase.from("admin_notifications").select("id, type, title, message, is_read, created_at").order("created_at", { ascending: false }).limit(30),
        supabase.from("song_audio_versions").select("song_id, status, error, updated_at").eq("kind", "instrumental").order("updated_at", { ascending: false }),
        supabase.from("articles").select("id", { count: "exact", head: true }),
        supabase.from("game_sessions").select("user_id, score").limit(5000),
        supabase.from("analytics_events").select("event_data, created_at").eq("event_type", "create_menu_click").order("created_at", { ascending: false }).limit(5000),
        supabase.from("analytics_events").select("event_type, event_data, created_at").in("event_type", ["share_click", "share_visit", "app_download_click", "referral_signup"]).order("created_at", { ascending: false }).limit(10000),
      ]);
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;
      return {
        profiles: results[0].data ?? [], songs: (results[1].data ?? []) as Song[], plays: (results[2].data ?? []) as PlayEvent[],
        favorites: results[3].data ?? [], downloads: results[4].data ?? [], karaoke: results[5].data ?? [],
        subscriptions: results[6].data ?? [], notifications: results[7].data ?? [], stems: results[8].data ?? [],
        articles: results[9].count ?? 0, games: results[10].data ?? [],
        createClicks: (results[11].data ?? []) as { event_data: any; created_at: string }[],
        acquisition: (results[12].data ?? []) as { event_type: string; event_data: any; created_at: string }[],
      };
    },
  });

  const data = analytics.data;
  const model = useMemo(() => {
    if (!data) return null;
    const cutoff = range === "7d" ? Date.now() - 7 * 86400000 : range === "30d" ? Date.now() - 30 * 86400000 : 0;
    const plays = data.plays.filter((p) => new Date(p.created_at).getTime() >= cutoff);
    const songMap = new Map(data.songs.map((song) => [song.id, song]));
    const metrics = new Map<string, { plays: number; karaoke: number; favorites: number; downloads: number; listeners: Set<string> }>();
    const getMetric = (id: string) => {
      const current = metrics.get(id) ?? { plays: 0, karaoke: 0, favorites: 0, downloads: 0, listeners: new Set<string>() };
      metrics.set(id, current);
      return current;
    };
    plays.forEach((event) => { const m = getMetric(event.song_id); m.plays++; if (event.mode === "karaoke") m.karaoke++; if (event.user_id) m.listeners.add(event.user_id); });
    data.favorites.forEach((row) => getMetric(row.song_id).favorites++);
    data.downloads.forEach((row) => getMetric(row.song_id).downloads++);
    data.karaoke.forEach((row) => { if (new Date(row.created_at).getTime() >= cutoff) getMetric(row.song_id).karaoke++; });
    const contentRows = data.songs.map((song) => {
      const m = getMetric(song.id);
      return { ...song, ...m, listeners: m.listeners.size, engagement: m.plays + m.karaoke * 3 + m.favorites * 2 + m.downloads * 2 };
    }).sort((a, b) => b.engagement - a.engagement);
    const dayMap = new Map<string, { date: string; plays: number; karaoke: number }>();
    plays.forEach((event) => {
      const key = event.created_at.slice(0, 10);
      const day = dayMap.get(key) ?? { date: key.slice(5), plays: 0, karaoke: 0 };
      day.plays++; if (event.mode === "karaoke") day.karaoke++; dayMap.set(key, day);
    });
    const profileDays = new Map<string, number>();
    data.profiles.filter((p) => new Date(p.created_at).getTime() >= cutoff).forEach((p) => { const key = p.created_at.slice(0, 10); profileDays.set(key, (profileDays.get(key) ?? 0) + 1); });
    const listenerCounts = new Map<string, number>();
    plays.forEach((p) => { if (p.user_id) listenerCounts.set(p.user_id, (listenerCounts.get(p.user_id) ?? 0) + 1); });
    const profileMap = new Map(data.profiles.map((p) => [p.user_id, p]));
    const engaged = [...listenerCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, count]) => ({ ...profileMap.get(id), count }));
    const locationMap = new Map<string, number>();
    data.profiles.forEach((p) => { const label = p.region || p.zone; if (label) locationMap.set(label, (locationMap.get(label) ?? 0) + 1); });
    const locations = [...locationMap.entries()].map(([name, users]) => ({ name, users })).sort((a, b) => b.users - a.users).slice(0, 8);
    const subscriptions = data.subscriptions.reduce<Record<string, number>>((acc, sub) => {
      const expired = sub.subscription_expiry_date && new Date(sub.subscription_expiry_date).getTime() < Date.now();
      const key = expired ? "free" : sub.subscription; acc[key] = (acc[key] ?? 0) + 1; return acc;
    }, {});
    const expiring = data.subscriptions.filter((sub) => {
      if (!sub.subscription_expiry_date) return false;
      const days = (new Date(sub.subscription_expiry_date).getTime() - Date.now()) / 86400000;
      return days >= 0 && days <= 7;
    }).length;
    const issues = {
      artwork: data.songs.filter((s) => !s.cover_url).length, audio: data.songs.filter((s) => !s.audio_url).length,
      lyrics: data.songs.filter((s) => !s.lyrics_lrc && !s.lyrics_text).length, instrumental: data.songs.filter((s) => !s.instrumental_url).length,
      video: data.songs.filter((s) => !s.has_video).length, category: data.songs.filter((s) => !s.category_id).length,
    };
    const activeUsers = new Set(plays.map((p) => p.user_id).filter(Boolean)).size;
    const createCounts: Record<string, number> = { Playlist: 0, "Studio Mode": 0, Reminders: 0, "Stage Mode": 0 };
    data.createClicks.filter((c) => new Date(c.created_at).getTime() >= cutoff).forEach((c) => {
      const key = c.event_data?.option; if (key) createCounts[key] = (createCounts[key] ?? 0) + 1;
    });
    const createMenu = Object.entries(createCounts).map(([option, clicks]) => ({ option, clicks })).sort((a, b) => b.clicks - a.clicks);
    const acq = data.acquisition.filter((e) => new Date(e.created_at).getTime() >= cutoff);
    const chan = new Map<string, { channel: string; shares: number; visits: number; signups: number; downloads: number }>();
    const slot = (c?: string) => { const k = c || "direct"; const v = chan.get(k) ?? { channel: CHANNEL_LABELS[k] ?? k, shares: 0, visits: 0, signups: 0, downloads: 0 }; chan.set(k, v); return v; };
    const surfaces = new Map<string, number>();
    acq.forEach((e) => {
      if (e.event_type === "share_click") slot(e.event_data?.channel).shares++;
      if (e.event_type === "share_visit") slot(e.event_data?.channel).visits++;
      if (e.event_type === "referral_signup") slot(e.event_data?.channel).signups++;
      if (e.event_type === "app_download_click") { slot(e.event_data?.source).downloads++; const k = `${e.event_data?.surface ?? "unknown"} · ${e.event_data?.platform ?? "web"}`; surfaces.set(k, (surfaces.get(k) ?? 0) + 1); }
    });
    const channels = [...chan.values()].sort((a, b) => b.signups - a.signups || b.shares - a.shares);
    const acqTotals = channels.reduce((t, c) => ({ shares: t.shares + c.shares, visits: t.visits + c.visits, signups: t.signups + c.signups, downloads: t.downloads + c.downloads }), { shares: 0, visits: 0, signups: 0, downloads: 0 });
    const downloadSurfaces = [...surfaces.entries()].map(([name, clicks]) => ({ name, clicks })).sort((a, b) => b.clicks - a.clicks);
    return { channels, acqTotals, downloadSurfaces, createMenu, plays, contentRows, playDays: [...dayMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => value), profileDays: [...profileDays.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, users]) => ({ date: date.slice(5), users })), engaged, locations, subscriptions, expiring, issues, activeUsers, songMap };
  }, [data, range]);

  if (adminLoading) return <AppLayout><div className="p-6 text-center text-muted-foreground">Loading...</div></AppLayout>;
  if (!isAdmin) return <AppLayout><div className="p-6 text-center text-muted-foreground">Admin access required.</div></AppLayout>;

  const rangeLabel = range === "all" ? "all time" : `last ${range}`;
  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl px-4 pb-10 pt-4 lg:px-6 lg:pt-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-xs font-semibold uppercase tracking-widest text-gold">Admin v2</p><h1 className="mt-1 flex items-center gap-2 text-2xl font-serif font-bold text-foreground"><BarChart3 className="h-6 w-6 text-gold" /> Command Centre</h1></div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg bg-muted p-1">
              {(["7d", "30d", "all"] as Range[]).map((item) => <Button key={item} size="sm" variant={range === item ? "default" : "ghost"} onClick={() => setRange(item)} className="h-8 px-3 text-xs">{item === "all" ? "All" : item}</Button>)}
            </div>
            <Button size="icon" variant="outline" onClick={() => analytics.refetch()} aria-label="Refresh dashboard"><RefreshCw className={`h-4 w-4 ${analytics.isFetching ? "animate-spin" : ""}`} /></Button>
          </div>
        </div>

        {analytics.isLoading || !data || !model ? <div className="py-20 text-center text-muted-foreground">Loading live insights...</div> : analytics.error ? <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-destructive">Dashboard data could not be loaded.</div> : (
          <Tabs defaultValue="overview">
            <TabsList className="mb-5 grid h-auto w-full grid-cols-5 overflow-x-auto">
              <TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="content">Content</TabsTrigger><TabsTrigger value="audience">Audience</TabsTrigger><TabsTrigger value="operations">Operations</TabsTrigger><TabsTrigger value="sharing">Sharing</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard icon={Users} label="Active listeners" value={model.activeUsers} sub={rangeLabel} />
                <StatCard icon={Play} label="Plays" value={model.plays.length} sub={rangeLabel} />
                <StatCard icon={Music} label="Songs" value={data.songs.length} sub={`${data.songs.filter((s) => s.is_featured).length} featured`} />
                <StatCard icon={Crown} label="Premium & trial" value={(model.subscriptions.premium ?? 0) + (model.subscriptions.trial ?? 0)} sub={`${model.expiring} expire within 7 days`} />
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                <div className={panel}><h2 className="mb-4 flex items-center gap-2 font-semibold text-foreground"><Activity className="h-4 w-4 text-gold" /> Listening activity</h2><div className="h-64">{model.playDays.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={model.playDays}><CartesianGrid stroke="hsl(var(--border))" vertical={false} /><XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} /><YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="plays" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} /><Bar dataKey="karaoke" fill="hsl(var(--gold))" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer> : empty("No listening activity in this period")}</div></div>
                <div className={panel}><h2 className="mb-4 flex items-center gap-2 font-semibold text-foreground"><Users className="h-4 w-4 text-gold" /> New users</h2><div className="h-64">{model.profileDays.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={model.profileDays}><CartesianGrid stroke="hsl(var(--border))" vertical={false} /><XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} /><YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} /><Tooltip contentStyle={tooltipStyle} /><Line dataKey="users" stroke="hsl(var(--gold))" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer> : empty("No new users in this period")}</div></div>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4"><StatCard icon={Heart} label="Favorites" value={data.favorites.length} /><StatCard icon={Download} label="Downloads" value={data.downloads.length} /><StatCard icon={Mic2} label="Recordings" value={data.karaoke.length} /><StatCard icon={BookOpen} label="Articles" value={data.articles} /></div>
              <div className={panel}>
                <h2 className="mb-4 flex items-center gap-2 font-semibold text-foreground"><BarChart3 className="h-4 w-4 text-gold" /> Create menu usage <span className="text-xs font-normal text-muted-foreground">({rangeLabel})</span></h2>
                <div className="h-56">{model.createMenu.some((c) => c.clicks > 0) ? <ResponsiveContainer width="100%" height="100%"><BarChart data={model.createMenu} layout="vertical" margin={{ left: 20 }}><CartesianGrid stroke="hsl(var(--border))" horizontal={false} /><XAxis type="number" allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={11} /><YAxis type="category" dataKey="option" stroke="hsl(var(--muted-foreground))" fontSize={11} width={90} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="clicks" fill="hsl(var(--gold))" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer> : empty("No Create menu taps in this period yet")}</div>
              </div>
            </TabsContent>

            <TabsContent value="content" className="space-y-6">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><StatCard icon={Play} label="Song plays" value={model.plays.length} sub={rangeLabel} /><StatCard icon={Mic2} label="Karaoke activity" value={model.contentRows.reduce((sum, s) => sum + s.karaoke, 0)} /><StatCard icon={Gamepad2} label="Game sessions" value={data.games.length} /><StatCard icon={BookOpen} label="Published library" value={data.articles} sub="articles" /></div>
              <div className={`${panel} overflow-hidden p-0`}><div className="border-b border-border p-4"><h2 className="font-semibold text-foreground">Song performance</h2><p className="text-xs text-muted-foreground">Ranked by plays, singing, favorites, and downloads.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead className="bg-muted/40 text-left text-xs text-muted-foreground"><tr><th className="px-4 py-3">Song</th><th className="px-3 py-3 text-right">Plays</th><th className="px-3 py-3 text-right">Listeners</th><th className="px-3 py-3 text-right">Karaoke</th><th className="px-3 py-3 text-right">Favorites</th><th className="px-4 py-3 text-right">Downloads</th></tr></thead><tbody>{model.contentRows.slice(0, 25).map((song) => <tr key={song.id} className="border-t border-border/70"><td className="px-4 py-3"><div className="flex items-center gap-3">{song.cover_url ? <img src={song.cover_url} alt="" className="h-9 w-9 rounded-md object-cover" /> : <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted"><Music className="h-4 w-4 text-muted-foreground" /></div>}<div><p className="font-medium text-foreground">{song.title}</p><p className="text-xs text-foreground">{song.artist}</p></div></div></td><td className="px-3 py-3 text-right tabular-nums">{song.plays}</td><td className="px-3 py-3 text-right tabular-nums">{song.listeners}</td><td className="px-3 py-3 text-right tabular-nums">{song.karaoke}</td><td className="px-3 py-3 text-right tabular-nums">{song.favorites}</td><td className="px-4 py-3 text-right tabular-nums">{song.downloads}</td></tr>)}</tbody></table></div></div>
            </TabsContent>

            <TabsContent value="audience" className="space-y-6">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><StatCard icon={Users} label="Registered users" value={data.profiles.length} /><StatCard icon={Activity} label="Active listeners" value={model.activeUsers} sub={rangeLabel} /><StatCard icon={Crown} label="Premium" value={model.subscriptions.premium ?? 0} /><StatCard icon={Clock3} label="Expiring soon" value={model.expiring} sub="within 7 days" /></div>
              <div className="grid gap-6 lg:grid-cols-2">
                <div className={panel}><h2 className="mb-4 flex items-center gap-2 font-semibold text-foreground"><MapPin className="h-4 w-4 text-gold" /> Audience locations</h2>{model.locations.length ? <div className="space-y-3">{model.locations.map((location) => <div key={location.name}><div className="mb-1 flex justify-between text-sm"><span className="text-foreground">{location.name}</span><span className="text-muted-foreground">{location.users}</span></div><div className="h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(6, location.users / Math.max(model.locations[0]?.users ?? 1, 1) * 100)}%` }} /></div></div>)}</div> : empty("Location details have not been completed yet")}</div>
                <div className={panel}><h2 className="mb-4 flex items-center gap-2 font-semibold text-foreground"><Crown className="h-4 w-4 text-gold" /> Subscription mix</h2><div className="space-y-4">{["premium", "trial", "free"].map((tier) => <div key={tier} className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-3"><span className="capitalize text-foreground">{tier}</span><span className="font-bold text-foreground">{model.subscriptions[tier] ?? 0}</span></div>)}</div></div>
              </div>
              <div className={panel}><h2 className="mb-4 font-semibold text-foreground">Most engaged listeners</h2>{model.engaged.length ? <div className="grid gap-2 sm:grid-cols-2">{model.engaged.map((person, index) => <div key={person.user_id ?? index} className="flex items-center gap-3 rounded-lg bg-muted/30 p-3"><span className="w-5 text-center text-xs font-bold text-gold">{index + 1}</span>{person.avatar_url ? <img src={person.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" /> : <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-bold">{person.username?.[0]?.toUpperCase() ?? "U"}</div>}<div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-foreground">{person.username ?? "Listener"}</p><p className="text-xs text-muted-foreground">{person.count} plays</p></div></div>)}</div> : empty("No listening activity in this period")}</div>
            </TabsContent>

            <TabsContent value="sharing" className="space-y-6">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard icon={Share2} label="Share taps" value={model.acqTotals.shares} sub={rangeLabel} />
                <StatCard icon={Users} label="Visits from shares" value={model.acqTotals.visits} sub={rangeLabel} />
                <StatCard icon={UserPlus} label="Referral sign-ups" value={model.acqTotals.signups} sub={model.acqTotals.shares ? `${Math.round(model.acqTotals.signups / model.acqTotals.shares * 100)}% of share taps` : rangeLabel} />
                <StatCard icon={Download} label="App download taps" value={model.acqTotals.downloads} sub={rangeLabel} />
              </div>
              <div className={panel}>
                <h2 className="mb-4 flex items-center gap-2 font-semibold text-foreground"><Share2 className="h-4 w-4 text-gold" /> Channels bringing new users <span className="text-xs font-normal text-muted-foreground">({rangeLabel})</span></h2>
                <div className="h-64">{model.channels.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={model.channels}><CartesianGrid stroke="hsl(var(--border))" vertical={false} /><XAxis dataKey="channel" stroke="hsl(var(--muted-foreground))" fontSize={11} /><YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={11} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="shares" name="Share taps" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} /><Bar dataKey="visits" name="Visits" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} /><Bar dataKey="signups" name="Sign-ups" fill="hsl(var(--gold))" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer> : empty("No sharing activity in this period yet")}</div>
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                <div className={`${panel} overflow-hidden p-0`}><div className="border-b border-border p-4"><h2 className="font-semibold text-foreground">Channel breakdown</h2></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/40 text-left text-xs text-muted-foreground"><tr><th className="px-4 py-3">Channel</th><th className="px-3 py-3 text-right">Shares</th><th className="px-3 py-3 text-right">Visits</th><th className="px-3 py-3 text-right">Sign-ups</th><th className="px-4 py-3 text-right">Downloads</th></tr></thead><tbody>{model.channels.map((c) => <tr key={c.channel} className="border-t border-border/70"><td className="px-4 py-3 text-foreground">{c.channel}</td><td className="px-3 py-3 text-right tabular-nums">{c.shares}</td><td className="px-3 py-3 text-right tabular-nums">{c.visits}</td><td className="px-3 py-3 text-right tabular-nums">{c.signups}</td><td className="px-4 py-3 text-right tabular-nums">{c.downloads}</td></tr>)}</tbody></table>{!model.channels.length && empty("Nothing yet")}</div></div>
                <div className={panel}><h2 className="mb-4 flex items-center gap-2 font-semibold text-foreground"><Download className="h-4 w-4 text-gold" /> Where app downloads start</h2>{model.downloadSurfaces.length ? <div className="space-y-2">{model.downloadSurfaces.map((d) => <div key={d.name} className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-3 text-sm"><span className="capitalize text-foreground">{d.name.replace("_", " ")}</span><span className="font-bold text-foreground">{d.clicks}</span></div>)}</div> : empty("No download taps in this period yet")}</div>
              </div>
            </TabsContent>

            <TabsContent value="operations" className="space-y-6">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><StatCard icon={AlertTriangle} label="Content gaps" value={Object.values(model.issues).reduce((a, b) => a + b, 0)} /><StatCard icon={Activity} label="Active stem jobs" value={data.stems.filter((s) => s.status === "pending" || s.status === "processing").length} /><StatCard icon={AlertTriangle} label="Failed stem jobs" value={data.stems.filter((s) => s.status === "failed").length} /><StatCard icon={CheckCircle2} label="Unread alerts" value={data.notifications.filter((n) => !n.is_read).length} /></div>
              <div className="grid gap-6 lg:grid-cols-2">
                <div className={panel}><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-foreground">Catalogue health</h2><p className="text-xs text-muted-foreground">Items requiring content work.</p></div><Button size="sm" variant="outline" onClick={() => navigate("/admin/songs")}>Manage songs</Button></div><div className="grid grid-cols-2 gap-2">{Object.entries(model.issues).map(([name, value]) => <div key={name} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-3 text-sm"><span className="capitalize text-muted-foreground">Missing {name}</span><span className={value ? "font-bold text-destructive" : "font-bold text-gold"}>{value}</span></div>)}</div></div>
                <div className={panel}><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-foreground">Admin alerts</h2><p className="text-xs text-muted-foreground">Latest operational updates.</p></div><Button size="sm" variant="outline" onClick={() => navigate("/admin/songs")}>Stem Studio</Button></div>{data.notifications.length ? <div className="max-h-80 space-y-2 overflow-y-auto">{data.notifications.slice(0, 12).map((note) => <div key={note.id} className={`rounded-lg border p-3 ${note.is_read ? "border-border bg-muted/20" : "border-gold/30 bg-gold/5"}`}><div className="flex items-start justify-between gap-3"><p className="text-sm font-medium text-foreground">{note.title}</p><span className="shrink-0 text-[10px] text-muted-foreground">{new Date(note.created_at).toLocaleDateString()}</span></div>{note.message && <p className="mt-1 text-xs text-muted-foreground">{note.message}</p>}</div>)}</div> : empty("No operational alerts")}</div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
};

export default AdminAnalytics;