import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Activity, AlertTriangle, BarChart3, BookOpen, CheckCircle2, Clock3, Crown,
  Download, Gamepad2, Globe2, Share2, UserPlus, Heart, MapPin, Mic2, Music, Play, RefreshCw, Users,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { supabase } from "@/integrations/supabase/client";
import { CHANNEL_LABELS } from "@/lib/acquisitionAnalytics";
import {
  CREATE_MENU_OPTIONS, MAX_RANGE_DAYS, RANGE_PRESETS, alertTypeLabel, fmt, gameModeLabel, listenerTierParts, parseRangeDays, premiumPlanParts, rangeLabel as labelFor,
  type CommandCentreStats, type CountryStats, type Part, type RangeDays,
} from "@/lib/commandCentre";
import { countryFlag, countryName } from "@/lib/activityCountry";

const panel = "rounded-xl border border-border bg-card p-4";
const tooltipStyle = { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 };

/** A headline figure with the numbers that make it up underneath. */
const StatCard = ({ icon: Icon, label, value, sub, parts }: { icon: typeof Users; label: string; value: number; sub?: string; parts?: Part[] }) => (
  <div className={panel}>
    <div className="flex items-center gap-2 text-muted-foreground"><Icon className="h-4 w-4 shrink-0" /><span className="text-xs font-medium">{label}</span></div>
    <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{fmt(value)}</p>
    {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    {parts && parts.length > 0 && (
      <dl className="mt-3 space-y-1 border-t border-border/70 pt-2">
        {parts.map((p) => (
          <div key={p.label} className="flex items-center justify-between gap-2 text-xs">
            <dt className="truncate text-muted-foreground">{p.label}</dt>
            <dd className="font-semibold tabular-nums text-foreground">{fmt(p.value)}</dd>
          </div>
        ))}
      </dl>
    )}
  </div>
);

const titleCase = (text: string) => text.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).replace("Ios", "iOS");

const empty = (message: string) => <p className="py-8 text-center text-sm text-muted-foreground">{message}</p>;

const AdminAnalytics = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [days, setDays] = useState<RangeDays>(30);
  const [customDays, setCustomDays] = useState("");
  const isPreset = RANGE_PRESETS.some((p) => p.days === days);
  const applyCustom = () => { const n = parseRangeDays(customDays); if (n) setDays(n); };

  const stats = useQuery({
    queryKey: ["admin-command-centre", days],
    enabled: isAdmin,
    placeholderData: (previous) => previous,
    queryFn: async () => {
      const [main, referrals] = await Promise.all([
        supabase.rpc("admin_command_centre", { p_days: days as number }),
        supabase.rpc("admin_referral_stats", { p_days: days as number }),
      ]);
      if (main.error) throw main.error;
      if (referrals.error) throw referrals.error;
      return { ...(main.data as unknown as CommandCentreStats), referrals: referrals.data as unknown as CommandCentreStats["referrals"] };
    },
  });

  const countries = useQuery({
    queryKey: ["admin-command-centre-countries", days],
    enabled: isAdmin,
    placeholderData: (previous) => previous,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_country_stats", { p_days: days as number });
      if (error) throw error;
      return data as unknown as CountryStats;
    },
  });

  const alerts = useQuery({
    queryKey: ["admin-command-centre-alerts"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("admin_notifications").select("id, type, title, message, is_read, created_at").order("created_at", { ascending: false }).limit(12);
      if (error) throw error;
      return data ?? [];
    },
  });

  const s = stats.data;
  const view = useMemo(() => {
    if (!s) return null;
    const createMenu = [...new Set([...CREATE_MENU_OPTIONS, ...Object.keys(s.create_menu)])]
      .map((option) => ({ option, clicks: s.create_menu[option] ?? 0 })).sort((a, b) => b.clicks - a.clicks);
    const channels = s.channels.map((c) => ({ ...c, channel: CHANNEL_LABELS[c.channel] ?? c.channel }))
      .sort((a, b) => b.signups - a.signups || b.shares - a.shares || b.downloads - a.downloads);
    const acq = channels.reduce((t, c) => ({ shares: t.shares + c.shares, visits: t.visits + c.visits, signups: t.signups + c.signups, downloads: t.downloads + c.downloads }), { shares: 0, visits: 0, signups: 0, downloads: 0 });
    const topChannels = (key: "shares" | "visits" | "signups" | "downloads") =>
      [...channels].filter((c) => c[key] > 0).sort((a, b) => b[key] - a[key]).slice(0, 3).map((c) => ({ label: c.channel, value: c[key] }));
    const gameModes = Object.entries(s.games.by_mode).sort((a, b) => b[1] - a[1]).map(([mode, n]) => ({ label: gameModeLabel(mode), value: n }));
    const unreadTypes = Object.entries(s.alerts.unread_by_type).sort((a, b) => b[1] - a[1]).map(([type, n]) => ({ label: alertTypeLabel(type), value: n }));
    const playDays = s.play_days.map((d) => ({ ...d, date: d.date.slice(5), listen: d.plays - d.karaoke - d.video }));
    const userDays = s.user_days.map((d) => ({ ...d, date: d.date.slice(5) }));
    const issues = [
      { name: "Missing artwork", value: s.issues.artwork },
      { name: "Missing audio", value: s.issues.audio },
      { name: "Missing lyrics", value: s.issues.lyrics, note: "instrumentals excluded" },
      { name: "Missing karaoke track", value: s.issues.karaoke_track, note: "instrumentals excluded" },
      { name: "Missing video", value: s.issues.video },
      { name: "No category", value: s.issues.category },
    ];
    return { createMenu, channels, acq, topChannels, gameModes, unreadTypes, playDays, userDays, issues };
  }, [s]);

  if (adminLoading) return <AppLayout><div className="p-6 text-center text-muted-foreground">Loading...</div></AppLayout>;
  if (!isAdmin) return <AppLayout><div className="p-6 text-center text-muted-foreground">Admin access required.</div></AppLayout>;

  const rangeLabel = labelFor(days);
  const refresh = () => { stats.refetch(); countries.refetch(); alerts.refetch(); };
  const c = countries.data;
  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl px-4 pb-10 pt-4 lg:px-6 lg:pt-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gold">Admin v2</p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-serif font-bold text-foreground"><BarChart3 className="h-6 w-6 text-gold" /> Command Centre</h1>
            {s && <p className="mt-1 text-xs text-muted-foreground">Live totals · updated {new Date(s.generated_at).toLocaleTimeString()} · activity figures cover the {rangeLabel}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg bg-muted p-1">
              {RANGE_PRESETS.map((item) => <Button key={item.label} size="sm" variant={days === item.days ? "default" : "ghost"} onClick={() => { setDays(item.days); setCustomDays(""); }} className="h-8 px-3 text-xs">{item.label}</Button>)}
            </div>
            <form className="flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); applyCustom(); }}>
              <Input type="number" inputMode="numeric" min={1} max={MAX_RANGE_DAYS} step={1} value={customDays} onChange={(e) => setCustomDays(e.target.value)} placeholder="Days" aria-label="Number of days" className={`h-9 w-20 text-xs ${!isPreset ? "border-gold" : ""}`} />
              <Button type="submit" size="sm" variant={!isPreset ? "default" : "outline"} className="h-9 px-3 text-xs" disabled={!parseRangeDays(customDays)}>Apply</Button>
            </form>
            <Button size="icon" variant="outline" onClick={refresh} aria-label="Refresh dashboard"><RefreshCw className={`h-4 w-4 ${stats.isFetching ? "animate-spin" : ""}`} /></Button>
          </div>
        </div>

        {stats.error ? <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-destructive">Dashboard data could not be loaded. Tap refresh to try again.</div>
        : !s || !view ? <div className="py-20 text-center text-muted-foreground">Loading live insights...</div> : (
          <Tabs defaultValue="overview">
            <TabsList className="mb-5 grid h-auto w-full grid-cols-5 overflow-x-auto">
              <TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="content">Content</TabsTrigger><TabsTrigger value="audience">Audience</TabsTrigger><TabsTrigger value="operations">Operations</TabsTrigger><TabsTrigger value="sharing">Sharing</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard icon={Users} label="Active listeners" value={s.plays.listeners} sub={`played a song · ${rangeLabel}`} parts={listenerTierParts(s.plays)} />
                <StatCard icon={Play} label="Plays" value={s.plays.total} sub={`${fmt(s.plays.all_time)} all time`} parts={[
                  { label: "Listened", value: s.plays.song }, { label: "Sung (karaoke)", value: s.plays.karaoke }, { label: "Watched (video)", value: s.plays.video }, { label: "Different songs", value: s.plays.songs_played },
                ]} />
                <StatCard icon={Music} label="Songs" value={s.songs.total} sub="in the library" parts={[
                  { label: "Featured", value: s.songs.featured }, { label: "With video", value: s.songs.with_video }, { label: "With lyrics", value: s.songs.with_lyrics }, { label: "With karaoke track", value: s.songs.with_karaoke_track }, { label: "Free to download", value: s.songs.free },
                ]} />
                <StatCard icon={Crown} label="Premium & trial" value={s.subs.premium + s.subs.trial} sub="active right now" parts={[
                  ...premiumPlanParts(s.subs).map((p) => ({ ...p, label: `Premium · ${p.label}` })), { label: "Free trial", value: s.subs.trial }, { label: "Expire within 7 days", value: s.subs.expiring_premium + s.subs.expiring_trial },
                ]} />
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                <div className={panel}><h2 className="mb-4 flex items-center gap-2 font-semibold text-foreground"><Activity className="h-4 w-4 text-gold" /> Listening activity <span className="text-xs font-normal text-muted-foreground">({rangeLabel})</span></h2><div className="h-64">{view.playDays.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={view.playDays}><CartesianGrid stroke="hsl(var(--border))" vertical={false} /><XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} /><YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={11} /><Tooltip contentStyle={tooltipStyle} /><Legend wrapperStyle={{ fontSize: 11 }} /><Bar dataKey="listen" name="Listened" stackId="p" fill="hsl(var(--accent))" /><Bar dataKey="karaoke" name="Sung" stackId="p" fill="hsl(var(--gold))" /><Bar dataKey="video" name="Watched" stackId="p" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer> : empty("No listening activity in this period")}</div></div>
                <div className={panel}><h2 className="mb-4 flex items-center gap-2 font-semibold text-foreground"><Users className="h-4 w-4 text-gold" /> New users <span className="text-xs font-normal text-muted-foreground">({fmt(s.users.new_in_range)} · {rangeLabel})</span></h2><div className="h-64">{view.userDays.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={view.userDays}><CartesianGrid stroke="hsl(var(--border))" vertical={false} /><XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} /><YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={11} /><Tooltip contentStyle={tooltipStyle} /><Line dataKey="users" name="New users" stroke="hsl(var(--gold))" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer> : empty("No new users in this period")}</div></div>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatCard icon={Heart} label="Favourites" value={s.favorites.in_range} sub={`${fmt(s.favorites.total)} all time`} parts={[{ label: "People", value: s.favorites.users }, { label: "Different songs", value: s.favorites.songs }]} />
                <StatCard icon={Download} label="Downloads" value={s.downloads.in_range} sub={`${fmt(s.downloads.total)} saved on devices now`} parts={[{ label: "People", value: s.downloads.users }, { label: "Different songs", value: s.downloads.songs }, { label: "Removed by users", value: s.downloads.removed }]} />
                <StatCard icon={Mic2} label="Recordings" value={s.recordings.in_range} sub={`${fmt(s.recordings.total)} all time`} parts={[{ label: "Singers", value: s.recordings.singers }, { label: "Live stories (24h)", value: s.recordings.live_24h }]} />
                <StatCard icon={BookOpen} label="Articles" value={s.articles.total} sub="in the library" parts={[{ label: "Published", value: s.articles.published }, { label: "Drafts", value: s.articles.drafts }, { label: "Featured", value: s.articles.featured }, { label: `Reads (${rangeLabel})`, value: s.articles.reads_in_range }]} />
              </div>
              <div className={panel}>
                <h2 className="mb-4 flex items-center gap-2 font-semibold text-foreground"><BarChart3 className="h-4 w-4 text-gold" /> Create menu usage <span className="text-xs font-normal text-muted-foreground">({fmt(view.createMenu.reduce((t, c) => t + c.clicks, 0))} taps · {rangeLabel})</span></h2>
                <div className="h-56">{view.createMenu.some((c) => c.clicks > 0) ? <ResponsiveContainer width="100%" height="100%"><BarChart data={view.createMenu} layout="vertical" margin={{ left: 20 }}><CartesianGrid stroke="hsl(var(--border))" horizontal={false} /><XAxis type="number" allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={11} /><YAxis type="category" dataKey="option" stroke="hsl(var(--muted-foreground))" fontSize={11} width={90} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="clicks" name="Taps" fill="hsl(var(--gold))" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer> : empty("No Create menu taps in this period yet")}</div>
              </div>
            </TabsContent>

            <TabsContent value="content" className="space-y-6">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard icon={Play} label="Song plays" value={s.plays.total} sub={rangeLabel} parts={[{ label: "Listened", value: s.plays.song }, { label: "Sung (karaoke)", value: s.plays.karaoke }, { label: "Watched (video)", value: s.plays.video }]} />
                <StatCard icon={Mic2} label="Karaoke activity" value={s.plays.karaoke + s.recordings.in_range} sub={rangeLabel} parts={[{ label: "Songs sung", value: s.plays.karaoke }, { label: "Recordings made", value: s.recordings.in_range }, { label: "Singers who recorded", value: s.recordings.singers }]} />
                <StatCard icon={Gamepad2} label="Game sessions" value={s.games.in_range} sub={`${fmt(s.games.total)} all time · ${fmt(s.games.players)} players`} parts={view.gameModes} />
                <StatCard icon={BookOpen} label="Published articles" value={s.articles.published} sub={`${fmt(s.articles.total)} in total`} parts={[{ label: "Drafts", value: s.articles.drafts }, { label: "Featured", value: s.articles.featured }, { label: `Reads (${rangeLabel})`, value: s.articles.reads_in_range }]} />
              </div>
              <div className={`${panel} overflow-hidden p-0`}><div className="border-b border-border p-4"><h2 className="font-semibold text-foreground">Song performance</h2><p className="text-xs text-muted-foreground">Top 25 for the {rangeLabel}, ranked by plays, singing, favourites and downloads. Karaoke = songs sung + recordings.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead className="bg-muted/40 text-left text-xs text-muted-foreground"><tr><th className="px-4 py-3">Song</th><th className="px-3 py-3 text-right">Plays</th><th className="px-3 py-3 text-right">Listeners</th><th className="px-3 py-3 text-right">Karaoke</th><th className="px-3 py-3 text-right">Favourites</th><th className="px-4 py-3 text-right">Downloads</th></tr></thead><tbody>{s.top_songs.map((song) => <tr key={song.id} className="border-t border-border/70"><td className="px-4 py-3"><div className="flex items-center gap-3">{song.cover_url ? <img src={song.cover_url} alt="" className="h-9 w-9 rounded-md object-cover" /> : <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted"><Music className="h-4 w-4 text-muted-foreground" /></div>}<div><p className="font-medium text-foreground">{song.title}</p><p className="text-xs text-foreground">{song.artist}</p></div></div></td><td className="px-3 py-3 text-right tabular-nums">{fmt(song.plays)}</td><td className="px-3 py-3 text-right tabular-nums">{fmt(song.listeners)}</td><td className="px-3 py-3 text-right tabular-nums">{fmt(song.karaoke)}</td><td className="px-3 py-3 text-right tabular-nums">{fmt(song.favorites)}</td><td className="px-4 py-3 text-right tabular-nums">{fmt(song.downloads)}</td></tr>)}</tbody></table>{!s.top_songs.length && empty("No songs yet")}</div></div>
            </TabsContent>

            <TabsContent value="audience" className="space-y-6">
              <div className={panel}>
                <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="flex items-center gap-2 font-semibold text-foreground"><Globe2 className="h-4 w-4 text-gold" /> Countries using the app <span className="text-xs font-normal text-muted-foreground">({rangeLabel})</span></h2>
                    {c && <p className="mt-1 text-xs text-muted-foreground">{fmt(c.active_users)} signed-in people opened the app in {fmt(c.countries_count)} {c.countries_count === 1 ? "country" : "countries"}{c.unknown_users ? ` · ${fmt(c.unknown_users)} couldn't be located` : ""}{c.tracked_since ? ` · counting since ${new Date(c.tracked_since + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}` : ""}</p>}
                  </div>
                  {c && c.active_users > 0 && <div className="flex gap-4 text-xs text-muted-foreground"><span>By network: <b className="text-foreground">{fmt(c.by_network)}</b></span><span>By time zone: <b className="text-foreground">{fmt(c.by_timezone)}</b></span></div>}
                </div>
                {countries.error ? empty("Countries could not be loaded. Tap refresh to try again.")
                : !c ? empty("Loading countries...")
                : c.countries.length ? <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">{c.countries.map((country) => {
                    const share = c.located_users ? Math.round((country.users / c.located_users) * 100) : 0;
                    return <div key={country.code}><div className="mb-1 flex items-center justify-between gap-2 text-sm"><span className="flex min-w-0 items-center gap-2 text-foreground"><span aria-hidden className="text-base leading-none">{countryFlag(country.code)}</span><span className="truncate">{countryName(country.code)}</span></span><span className="shrink-0 tabular-nums text-muted-foreground"><b className="text-foreground">{fmt(country.users)}</b> {country.users === 1 ? "person" : "people"} · {share}% · {fmt(country.active_days)} active days</span></div><div className="h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, country.users / Math.max(c.countries[0]?.users ?? 1, 1) * 100)}%` }} /></div></div>;
                  })}</div>
                : empty(c.tracked_since ? "Nobody signed in during this period" : "Countries start appearing as people open the app")}
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard icon={Users} label="Registered users" value={s.users.total} sub={`${fmt(s.users.new_in_range)} joined · ${rangeLabel}`} parts={[{ label: "Profile completed", value: s.users.completed_profile }, { label: "Profile not completed", value: s.users.incomplete_profile }, { label: "Admins", value: s.roles.admin }, { label: "Editors", value: s.roles.editor }]} />
                <StatCard icon={Activity} label="Active listeners" value={s.plays.listeners} sub={`${s.users.total ? Math.round((s.plays.listeners / s.users.total) * 100) : 0}% of users · ${rangeLabel}`} parts={listenerTierParts(s.plays)} />
                <StatCard icon={Crown} label="Premium" value={s.subs.premium} sub="active right now" parts={premiumPlanParts(s.subs)} />
                <StatCard icon={Clock3} label="Expiring soon" value={s.subs.expiring_premium + s.subs.expiring_trial} sub="within 7 days" parts={[{ label: "Premium", value: s.subs.expiring_premium }, { label: "Free trial", value: s.subs.expiring_trial }]} />
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                <div className={panel}><h2 className="mb-1 flex items-center gap-2 font-semibold text-foreground"><MapPin className="h-4 w-4 text-gold" /> Church regions &amp; zones</h2><p className="mb-4 text-xs text-muted-foreground">Top {Math.min(8, s.locations_count)} of {fmt(s.locations_count)} regions/zones from profiles · {fmt(s.users.with_location)} users gave a location, {fmt(s.users.without_location)} haven't</p>{s.locations.length ? <div className="space-y-3">{s.locations.map((location) => <div key={location.name}><div className="mb-1 flex justify-between text-sm"><span className="text-foreground">{location.name}</span><span className="tabular-nums text-muted-foreground">{fmt(location.users)}</span></div><div className="h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(6, location.users / Math.max(s.locations[0]?.users ?? 1, 1) * 100)}%` }} /></div></div>)}</div> : empty("Location details have not been completed yet")}</div>
                <div className={panel}><h2 className="mb-1 flex items-center gap-2 font-semibold text-foreground"><Crown className="h-4 w-4 text-gold" /> Subscription mix</h2><p className="mb-4 text-xs text-muted-foreground">Adds up to all {fmt(s.users.total)} users. Expired Premium or trial counts as Free.</p><div className="space-y-2">
                  <div className="rounded-lg bg-muted/40 px-4 py-3"><div className="flex items-center justify-between"><span className="text-foreground">Premium</span><span className="font-bold tabular-nums text-foreground">{fmt(s.subs.premium)}</span></div><div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">{premiumPlanParts(s.subs).map((p) => <span key={p.label}>{p.label}: <b className="text-foreground">{fmt(p.value)}</b></span>)}</div></div>
                  <div className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-3"><span className="text-foreground">Free trial</span><span className="font-bold tabular-nums text-foreground">{fmt(s.subs.trial)}</span></div>
                  <div className="rounded-lg bg-muted/40 px-4 py-3"><div className="flex items-center justify-between"><span className="text-foreground">Free</span><span className="font-bold tabular-nums text-foreground">{fmt(s.subs.free)}</span></div><p className="mt-1 text-xs text-muted-foreground">Includes {fmt(s.subs.expired_to_free)} whose Premium or trial has run out</p></div>
                </div></div>
              </div>
              <div className={panel}><h2 className="mb-4 font-semibold text-foreground">Most engaged listeners <span className="text-xs font-normal text-muted-foreground">({rangeLabel})</span></h2>{s.engaged.length ? <div className="grid gap-2 sm:grid-cols-2">{s.engaged.map((person, index) => <div key={person.user_id} className="flex items-center gap-3 rounded-lg bg-muted/30 p-3"><span className="w-5 text-center text-xs font-bold text-gold">{index + 1}</span>{person.avatar_url ? <img src={person.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" /> : <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-bold">{person.username?.[0]?.toUpperCase() ?? "U"}</div>}<div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-foreground">{person.username ?? "Listener"}</p><p className="text-xs text-muted-foreground">{fmt(person.plays)} plays</p></div></div>)}</div> : empty("No listening activity in this period")}</div>
            </TabsContent>

            <TabsContent value="sharing" className="space-y-6">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard icon={Share2} label="Share taps" value={view.acq.shares} sub={rangeLabel} parts={view.topChannels("shares")} />
                <StatCard icon={Users} label="Visits from shares" value={view.acq.visits} sub={rangeLabel} parts={view.topChannels("visits")} />
                <StatCard icon={UserPlus} label="Invited sign-ups" value={view.acq.signups} sub={`joined from an invite link · ${rangeLabel}`} parts={[
                  { label: "Credited to an inviter", value: s.referrals.credited_in_range }, ...view.topChannels("signups"),
                ]} />
                <StatCard icon={Download} label="App download taps" value={view.acq.downloads} sub={rangeLabel} parts={s.download_surfaces.slice(0, 3).map((d) => ({ label: titleCase(d.name), value: d.clicks }))} />
              </div>
              <div className={panel}>
                <h2 className="mb-4 flex items-center gap-2 font-semibold text-foreground"><Share2 className="h-4 w-4 text-gold" /> Channels bringing new users <span className="text-xs font-normal text-muted-foreground">({rangeLabel})</span></h2>
                <div className="h-64">{view.channels.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={view.channels}><CartesianGrid stroke="hsl(var(--border))" vertical={false} /><XAxis dataKey="channel" stroke="hsl(var(--muted-foreground))" fontSize={11} /><YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={11} /><Tooltip contentStyle={tooltipStyle} /><Legend wrapperStyle={{ fontSize: 11 }} /><Bar dataKey="shares" name="Share taps" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} /><Bar dataKey="visits" name="Visits" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} /><Bar dataKey="signups" name="Sign-ups" fill="hsl(var(--gold))" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer> : empty("No sharing activity in this period yet")}</div>
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                <div className={`${panel} overflow-hidden p-0`}><div className="border-b border-border p-4"><h2 className="font-semibold text-foreground">Channel breakdown</h2></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/40 text-left text-xs text-muted-foreground"><tr><th className="px-4 py-3">Channel</th><th className="px-3 py-3 text-right">Shares</th><th className="px-3 py-3 text-right">Visits</th><th className="px-3 py-3 text-right">Sign-ups</th><th className="px-4 py-3 text-right">Downloads</th></tr></thead><tbody>{view.channels.map((c) => <tr key={c.channel} className="border-t border-border/70"><td className="px-4 py-3 text-foreground">{c.channel}</td><td className="px-3 py-3 text-right tabular-nums">{fmt(c.shares)}</td><td className="px-3 py-3 text-right tabular-nums">{fmt(c.visits)}</td><td className="px-3 py-3 text-right tabular-nums">{fmt(c.signups)}</td><td className="px-4 py-3 text-right tabular-nums">{fmt(c.downloads)}</td></tr>)}{view.channels.length > 0 && <tr className="border-t border-border bg-muted/30 font-semibold"><td className="px-4 py-3 text-foreground">Total</td><td className="px-3 py-3 text-right tabular-nums">{fmt(view.acq.shares)}</td><td className="px-3 py-3 text-right tabular-nums">{fmt(view.acq.visits)}</td><td className="px-3 py-3 text-right tabular-nums">{fmt(view.acq.signups)}</td><td className="px-4 py-3 text-right tabular-nums">{fmt(view.acq.downloads)}</td></tr>}</tbody></table>{!view.channels.length && empty("Nothing yet")}</div></div>
                <div className={panel}><h2 className="mb-4 flex items-center gap-2 font-semibold text-foreground"><Download className="h-4 w-4 text-gold" /> Where app downloads start</h2>{s.download_surfaces.length ? <div className="space-y-2">{s.download_surfaces.map((d) => <div key={d.name} className="flex items-center justify-between rounded-lg bg-muted/40 px-4 py-3 text-sm"><span className="text-foreground">{titleCase(d.name)}</span><span className="font-bold tabular-nums text-foreground">{fmt(d.clicks)}</span></div>)}</div> : empty("No download taps in this period yet")}</div>
              </div>
            </TabsContent>

            <TabsContent value="operations" className="space-y-6">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard icon={AlertTriangle} label="Songs needing work" value={s.issues.songs_affected} sub={`of ${fmt(s.songs.total)} songs · one song can have several gaps`} parts={view.issues.filter((i) => i.value > 0).map((i) => ({ label: i.name, value: i.value }))} />
                <StatCard icon={Activity} label="Active karaoke-track jobs" value={s.stems.pending + s.stems.processing} sub={`${fmt(s.stems.total)} jobs in total`} parts={[{ label: "Waiting", value: s.stems.pending }, { label: "Processing", value: s.stems.processing }, { label: "Ready", value: s.stems.ready }]} />
                <StatCard icon={AlertTriangle} label="Failed karaoke-track jobs" value={s.stems.failed} sub={s.stems.total ? `${Math.round((s.stems.failed / s.stems.total) * 100)}% of all jobs` : undefined} parts={[{ label: "Ready", value: s.stems.ready }, { label: "Failed", value: s.stems.failed }]} />
                <StatCard icon={CheckCircle2} label="Unread alerts" value={s.alerts.unread} sub={`${fmt(s.alerts.total)} alerts in total`} parts={view.unreadTypes} />
              </div>
              <div className="grid gap-6 lg:grid-cols-2">
                <div className={panel}><div className="mb-4 flex items-center justify-between gap-2"><div><h2 className="font-semibold text-foreground">Catalogue health</h2><p className="text-xs text-muted-foreground">{fmt(s.issues.songs_affected)} of {fmt(s.songs.total)} songs need content work. {fmt(s.songs.instrumentals)} instrumentals don't need lyrics or a karaoke track.</p></div><Button size="sm" variant="outline" onClick={() => navigate("/admin/songs")}>Manage songs</Button></div><div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{view.issues.map((issue) => <div key={issue.name} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-3 text-sm"><span className="text-muted-foreground">{issue.name}{issue.note && <span className="block text-[10px]">{issue.note}</span>}</span><span className={`tabular-nums ${issue.value ? "font-bold text-destructive" : "font-bold text-gold"}`}>{fmt(issue.value)}</span></div>)}</div></div>
                <div className={panel}><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-foreground">Admin alerts</h2><p className="text-xs text-muted-foreground">Latest 12 of {fmt(s.alerts.total)} · {fmt(s.alerts.unread)} unread</p></div><Button size="sm" variant="outline" onClick={() => navigate("/admin/songs")}>Stem Studio</Button></div>{alerts.data?.length ? <div className="max-h-80 space-y-2 overflow-y-auto">{alerts.data.map((note) => <div key={note.id} className={`rounded-lg border p-3 ${note.is_read ? "border-border bg-muted/20" : "border-gold/30 bg-gold/5"}`}><div className="flex items-start justify-between gap-3"><p className="text-sm font-medium text-foreground">{note.title}</p><span className="shrink-0 text-[10px] text-muted-foreground">{new Date(note.created_at).toLocaleDateString()}</span></div>{note.message && <p className="mt-1 text-xs text-muted-foreground">{note.message}</p>}</div>)}</div> : empty("No operational alerts")}</div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
};

export default AdminAnalytics;
