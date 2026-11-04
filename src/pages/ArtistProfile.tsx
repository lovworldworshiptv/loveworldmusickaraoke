import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Play, Pause, Shuffle, ArrowLeft, MoreVertical, ChevronRight, Mic2, Video } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import ShareMenu, { buildShareUrl } from "@/components/share/ShareMenu";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { fetchAllRows } from "@/lib/fetchAll";
import { SONG_COLUMNS, toPlayerSong, type SongRow } from "@/lib/homeSongs";
import { compactNumber, matchArtists, useArtists, type Artist } from "@/lib/artists";
import { toast } from "sonner";
import { useArtworkPalette } from "@/hooks/useArtworkPalette";
import { rgb, rgba } from "@/lib/shareCardPalette";

type Row = SongRow & { play_count: number; has_video: boolean; created_at: string };
type Tab = "songs" | "karaoke" | "videos";

const ArtistProfile = () => {
  const { slug = "" } = useParams();
  const { data: artists, isLoading } = useArtists();
  const artist = artists?.find((a) => a.slug === slug);

  if (isLoading) return <AppLayout><ProfileSkeleton /></AppLayout>;
  if (!artist) {
    return (
      <AppLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6 gap-3">
          <h1 className="font-serif text-2xl text-foreground">Artist not found</h1>
          <p className="text-foreground">This artist page doesn't exist or was removed.</p>
          <Button asChild variant="outline"><Link to="/">Go to Home</Link></Button>
        </div>
      </AppLayout>
    );
  }
  return <AppLayout><ArtistView artist={artist} /></AppLayout>;
};

const ProfileSkeleton = () => (
  <div className="pb-24">
    <Skeleton className="w-full h-[360px] rounded-none" />
    <div className="px-4 mt-4 space-y-3"><Skeleton className="h-5 w-1/3" /><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /><Skeleton className="h-64 w-full" /></div>
  </div>
);

/** Full-bleed photo with the name set over its lower edge (used by the page and the admin preview). */
export const ArtistHero = ({ artist, overlay }: {
  artist: Pick<Artist, "name" | "image_url" | "cover_url" | "is_verified">;
  overlay?: React.ReactNode;
}) => (
  <div className="relative w-full h-[360px] sm:h-[420px] overflow-hidden">
    {artist.cover_url || artist.image_url ? (
      <img src={artist.cover_url || artist.image_url!} alt="" className="absolute inset-0 w-full h-full object-cover object-top" />
    ) : <div className="absolute inset-0 gradient-purple" />}
    <div className="absolute inset-0" style={{ backgroundImage: "linear-gradient(to top, var(--a-bg, hsl(var(--background))) 0%, var(--a-bg-soft, hsl(var(--background) / 0.35)) 45%, transparent 75%)" }} />
    {overlay}
    <div className="absolute bottom-4 left-4 right-4">
      <h1 className="font-serif text-[2.75rem] sm:text-6xl font-bold text-foreground leading-[1.02] break-words drop-shadow-lg">{artist.name}</h1>
      {artist.is_verified && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <BadgeCheck className="w-5 h-5 text-[var(--a-light,hsl(var(--gold)))]" aria-hidden /> Verified artist
        </p>
      )}
    </div>
  </div>
);

const ArtistView = ({ artist }: { artist: Artist }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const { playQueue, singQueue, playVideoQueue, currentSong, isPlaying, togglePlay } = usePlayer();
  const { data: artists = [] } = useArtists();
  const [tab, setTab] = useState<Tab>("songs");
  const [expanded, setExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const pal = useArtworkPalette(artist.image_url || artist.cover_url);
  const themeVars = {
    "--a-bg": rgb(pal.bg), "--a-bg-soft": rgba(pal.bg, 0.45), "--a-deep": rgb(pal.bgDeep),
    "--a-accent": rgb(pal.accent), "--a-light": rgb(pal.accentLight), "--a-dark": rgb(pal.accentDark),
    "--a-glow": rgba(pal.accent, 0.45), "--a-tint": rgba(pal.accent, 0.16), "--a-tint-strong": rgba(pal.accent, 0.28),
    backgroundImage: [
      `radial-gradient(90% 50% at 0% 35%, ${rgba(pal.accent, 0.30)} 0%, transparent 70%)`,
      `radial-gradient(80% 45% at 100% 70%, ${rgba(pal.accentLight, 0.18)} 0%, transparent 70%)`,
      `linear-gradient(160deg, ${rgb(pal.bg)} 0%, ${rgba(pal.accentDark, 0.85)} 38%, ${rgb(pal.bgDeep)} 72%, ${rgb(pal.bg)} 100%)`,
    ].join(", "),
    backgroundAttachment: "local",
    transition: "background-image 600ms ease",
  } as React.CSSProperties;

  const stats = useQuery({
    queryKey: ["artist-stats", artist.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_artist_stats", { p_artist_id: artist.id });
      const r = (data as { songs: number; karaoke: number; videos: number; followers: number }[] | null)?.[0];
      return r ?? { songs: 0, karaoke: 0, videos: 0, followers: 0 };
    },
  });
  const following = useQuery({
    queryKey: ["artist-following", artist.id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("artist_follows").select("artist_id").eq("artist_id", artist.id).eq("user_id", user!.id).maybeSingle();
      return !!data;
    },
  });
  const songs = useQuery({
    queryKey: ["artist-songs", artist.id],
    queryFn: async () => {
      const rows = await fetchAllRows<Row>((from, to) =>
        supabase.from("songs").select(`${SONG_COLUMNS},play_count,has_video,created_at`).ilike("artist", `%${artist.name}%`).order("id").range(from, to) as never);
      return rows
        .filter((s) => matchArtists(s.artist, artists).some((p) => p.artist?.id === artist.id))
        .sort((a, b) => b.play_count - a.play_count);
    },
    enabled: artists.length > 0,
  });

  const all = songs.data ?? [];
  const list = tab === "karaoke" ? all.filter((s) => s.instrumental_url) : tab === "videos" ? all.filter((s) => s.has_video) : all;
  const newest = all.reduce<Row | null>((n, s) => (!n || s.created_at > n.created_at ? s : n), null);
  const artistPlaying = !!currentSong && all.some((s) => s.id === currentSong.id);

  const toggleFollow = async () => {
    if (!user) { navigate(`/auth?next=${encodeURIComponent(location.pathname)}`); return; }
    const was = !!following.data;
    qc.setQueryData(["artist-following", artist.id, user.id], !was);
    qc.setQueryData(["artist-stats", artist.id], (s: typeof stats.data) => s && { ...s, followers: s.followers + (was ? -1 : 1) });
    const { error } = was
      ? await supabase.from("artist_follows").delete().eq("artist_id", artist.id).eq("user_id", user.id)
      : await supabase.from("artist_follows").insert({ artist_id: artist.id, user_id: user.id });
    if (error) {
      qc.setQueryData(["artist-following", artist.id, user.id], was);
      qc.invalidateQueries({ queryKey: ["artist-stats", artist.id] });
      toast.error("Couldn't update follow. Please try again.");
    }
  };

  const playAll = (shuffle = false) => {
    if (!shuffle && artistPlaying) { togglePlay(); return; }
    if (!all.length) return;
    const ps = all.map(toPlayerSong);
    if (shuffle) ps.sort(() => Math.random() - 0.5);
    playQueue(ps, 0);
  };
  const playRow = (i: number) => {
    const ps = list.map(toPlayerSong);
    if (tab === "karaoke") singQueue(ps, i); else if (tab === "videos") playVideoQueue(ps, i); else playQueue(ps, i);
  };

  useEffect(() => { document.title = `${artist.name} — Loveworld Music+`; }, [artist.name]);

  const s = stats.data;
  const tabs: { key: Tab; label: string; count?: number; heading: string }[] = [
    { key: "songs", label: "Songs", count: s?.songs, heading: "Popular" },
    { key: "karaoke", label: "Karaoke", count: s?.karaoke, heading: "Sing along" },
    { key: "videos", label: "Videos", count: s?.videos, heading: "Videos" },
  ];
  const shown = showAll ? list.slice(0, 200) : list.slice(0, 10);
  const roundBtn = "w-11 h-11 rounded-full bg-background/50 backdrop-blur-md flex items-center justify-center text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold";

  return (
    <div className="pb-28 min-h-full" style={themeVars}>
      <ArtistHero artist={artist} overlay={
        <div className="absolute top-3 left-3 right-3 flex justify-between">
          <button onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))} className={roundBtn} aria-label="Go back"><ArrowLeft className="w-5 h-5" /></button>
          <ShareMenu url={buildShareUrl(`/artist/${artist.slug}`)} title={artist.name} imageUrl={artist.image_url || undefined}
            trigger={<button className={roundBtn} aria-label="More options for this artist"><MoreVertical className="w-5 h-5" /></button>} />
        </div>
      } />

      <div className="px-4 max-w-4xl mx-auto">
        <p className="text-sm text-foreground h-5">
          {s ? `${s.followers.toLocaleString()} ${s.followers === 1 ? "follower" : "followers"}` : ""}
        </p>

        <div className="flex items-center gap-3 mt-3">
          {artist.image_url && <img src={artist.image_url} alt="" className="w-10 h-14 rounded-md object-cover border border-border" />}
          <Button variant="outline" onClick={toggleFollow} aria-pressed={!!following.data}
            className={`h-10 rounded-full px-5 bg-transparent ${following.data ? "border-[var(--a-light)] text-[var(--a-light)] bg-[var(--a-tint)]" : "border-foreground/50 text-foreground"}`}>
            {following.data ? "Following" : "Follow"}
          </Button>
          <div className="ml-auto flex items-center gap-3">
            <button onClick={() => playAll(true)} className="w-11 h-11 flex items-center justify-center text-[var(--a-light)]" aria-label="Shuffle play"><Shuffle className="w-6 h-6" /></button>
            <button onClick={() => playAll()} aria-label={artistPlaying && isPlaying ? "Pause" : `Play ${artist.name}`}
              className="w-14 h-14 rounded-full text-[var(--a-deep)] flex items-center justify-center shadow-[0_8px_28px_-6px_var(--a-glow)] bg-[linear-gradient(135deg,var(--a-light),var(--a-accent)_55%,var(--a-dark))] transition-transform active:scale-95 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--a-light)] focus-visible:ring-offset-2 focus-visible:ring-offset-background">
              {artistPlaying && isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-0.5" />}
            </button>
          </div>
        </div>

        {newest && (
          <button onClick={() => playQueue([toPlayerSong(newest)], 0)}
            className="mt-5 w-full flex items-center gap-3 rounded-xl bg-[var(--a-tint)] hover:bg-[var(--a-tint-strong)] border border-[var(--a-tint-strong)] backdrop-blur-md p-2 pr-3 text-left min-h-[56px]">
            {newest.cover_url ? <img src={newest.cover_url} alt="" className="w-10 h-10 rounded object-cover" /> : <div className="w-10 h-10 rounded bg-muted" />}
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold text-foreground">Listen to the newest song</span>
              <span className="block text-xs text-foreground truncate">{newest.title}</span>
            </span>
            <ChevronRight className="w-5 h-5 text-foreground" aria-hidden />
          </button>
        )}

        <div role="tablist" className="flex gap-2 mt-6 overflow-x-auto" aria-label="Artist content">
          {tabs.map((t) => (
            <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => { setTab(t.key); setShowAll(false); }}
              className={`shrink-0 min-h-[36px] px-4 rounded-full text-sm font-medium ${tab === t.key ? "bg-[var(--a-light)] text-[var(--a-deep)] font-semibold" : "bg-[var(--a-tint)] text-foreground border border-[var(--a-tint-strong)]"}`}>
              {t.label}{t.count !== undefined && <span className="ml-1.5 opacity-75 tabular-nums">{compactNumber(t.count)}</span>}
            </button>
          ))}
        </div>

        <section role="tabpanel" className="mt-5 min-h-[420px]">
          <h2 className="text-2xl font-bold text-foreground mb-3">{tabs.find((t) => t.key === tab)!.heading}</h2>
          {songs.isLoading ? (
            <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>
          ) : !list.length ? (
            <p className="text-foreground text-sm py-10">Nothing here yet.</p>
          ) : (
            <>
              <ol>
                {shown.map((song, i) => {
                  const active = currentSong?.id === song.id;
                  return (
                    <li key={song.id} className="flex items-center gap-1">
                      <button onClick={() => playRow(i)} className="flex-1 min-w-0 flex items-center gap-4 py-2 text-left min-h-[72px]" aria-current={active ? "true" : undefined}>
                        <span className={`w-5 text-center text-base tabular-nums ${active ? "text-[var(--a-light)]" : "text-foreground"}`}>{i + 1}</span>
                        <span className="relative shrink-0">
                          {song.cover_url ? <img src={song.cover_url} alt="" loading="lazy" className={`${tab === "videos" ? "w-24 h-14" : "w-14 h-14"} rounded object-cover`} /> : <span className="block w-14 h-14 rounded bg-muted" />}
                          {tab === "videos" && <Play className="absolute inset-0 m-auto w-5 h-5 text-foreground fill-current drop-shadow" aria-hidden />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className={`block text-base truncate ${active ? "text-[var(--a-light)] font-semibold" : "text-foreground"}`}>{song.title}</span>
                          <span className="block text-sm text-foreground tabular-nums">{song.play_count.toLocaleString()} {song.play_count === 1 ? "play" : "plays"}</span>
                        </span>
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="w-11 h-11 flex items-center justify-center text-foreground" aria-label={`More options for ${song.title}`}><MoreVertical className="w-5 h-5" /></button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => playQueue([toPlayerSong(song)], 0)}><Play className="w-4 h-4 mr-2" />Play</DropdownMenuItem>
                          {song.instrumental_url && <DropdownMenuItem onClick={() => singQueue([toPlayerSong(song)], 0)}><Mic2 className="w-4 h-4 mr-2" />Sing karaoke</DropdownMenuItem>}
                          {song.has_video && <DropdownMenuItem onClick={() => playVideoQueue([toPlayerSong(song)], 0)}><Video className="w-4 h-4 mr-2" />Watch video</DropdownMenuItem>}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </li>
                  );
                })}
              </ol>
              {list.length > 10 && (
                <button onClick={() => setShowAll((v) => !v)} className="mt-2 min-h-[44px] px-5 rounded-full border border-[var(--a-light)] text-sm font-semibold text-[var(--a-light)]">
                  {showAll ? "Show less" : "See more"}
                </button>
              )}
            </>
          )}
        </section>

        {artist.description && (
          <section className="mt-8">
            <h2 className="text-2xl font-bold text-foreground mb-3">About</h2>
            <div className="rounded-3xl overflow-hidden bg-[linear-gradient(160deg,var(--a-tint-strong),var(--a-tint)_60%,transparent)] border border-[var(--a-tint-strong)]">
              {artist.image_url && <img src={artist.image_url} alt="" className="w-full aspect-[16/10] object-cover" />}
              <div className="p-4">
                <p className={`text-sm text-foreground/90 whitespace-pre-line ${expanded ? "" : "line-clamp-4"}`}>{artist.description}</p>
                {artist.description.length > 220 && (
                  <button className="text-[var(--a-light)] text-sm font-semibold mt-1 min-h-[44px]" onClick={() => setExpanded((v) => !v)}>{expanded ? "Show less" : "Read more"}</button>
                )}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default ArtistProfile;
