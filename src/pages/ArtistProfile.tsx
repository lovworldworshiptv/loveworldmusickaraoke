import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useLocation, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Play, Shuffle, Share2, Mic2, Video, Music } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import ShareMenu, { buildShareUrl } from "@/components/share/ShareMenu";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { fetchAllRows } from "@/lib/fetchAll";
import { SONG_COLUMNS, toPlayerSong, type SongRow } from "@/lib/homeSongs";
import { compactNumber, matchArtists, useArtists, type Artist } from "@/lib/artists";
import { toast } from "sonner";

type Row = SongRow & { play_count: number; has_video: boolean };
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
          <h1 className="font-display text-2xl text-foreground">Artist not found</h1>
          <p className="text-muted-foreground">This artist page doesn't exist or was removed.</p>
          <Button asChild variant="outline"><Link to="/">Go to Home</Link></Button>
        </div>
      </AppLayout>
    );
  }
  return <AppLayout><ArtistView artist={artist} /></AppLayout>;
};

const ProfileSkeleton = () => (
  <div className="pb-24">
    <Skeleton className="w-full h-[300px] rounded-none" />
    <div className="px-4 mt-4 space-y-3"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>
  </div>
);

export const ArtistHero = ({ artist }: { artist: Pick<Artist, "name" | "image_url" | "cover_url" | "is_verified"> }) => (
  <div className="relative w-full h-[300px] sm:h-[360px] overflow-hidden">
    {artist.cover_url || artist.image_url ? (
      <img src={artist.cover_url || artist.image_url!} alt="" className="absolute inset-0 w-full h-full object-cover" />
    ) : <div className="absolute inset-0 gradient-purple" />}
    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
    <div className="absolute bottom-4 left-4 right-4 flex items-end gap-4">
      {artist.image_url && (
        <img src={artist.image_url} alt={artist.name} className="w-24 h-24 sm:w-32 sm:h-32 rounded-full object-cover border-2 border-gold/60 shadow-xl" />
      )}
      <div className="min-w-0">
        {artist.is_verified && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-gold"><BadgeCheck className="w-4 h-4" aria-hidden /> Verified artist</span>
        )}
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-foreground leading-tight break-words">{artist.name}</h1>
      </div>
    </div>
  </div>
);

const ArtistView = ({ artist }: { artist: Artist }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const { playQueue, singQueue, playVideoQueue } = usePlayer();
  const { data: artists = [] } = useArtists();
  const [tab, setTab] = useState<Tab>("songs");
  const [expanded, setExpanded] = useState(false);

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
        supabase.from("songs").select(`${SONG_COLUMNS},play_count,has_video`).ilike("artist", `%${artist.name}%`).order("id").range(from, to) as never);
      return rows
        .filter((s) => matchArtists(s.artist, artists).some((p) => p.artist?.id === artist.id))
        .sort((a, b) => b.play_count - a.play_count);
    },
    enabled: artists.length > 0,
  });

  const all = songs.data ?? [];
  const list = tab === "karaoke" ? all.filter((s) => s.instrumental_url) : tab === "videos" ? all.filter((s) => s.has_video) : all;

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
    if (!all.length) return;
    const ps = all.map(toPlayerSong);
    if (shuffle) ps.sort(() => Math.random() - 0.5);
    playQueue(ps, 0);
  };
  const playRow = (i: number) => {
    const ps = list.map(toPlayerSong);
    if (tab === "karaoke") singQueue(ps, i); else if (tab === "videos") playVideoQueue(ps, i); else playQueue(ps, i);
  };

  const s = stats.data;
  const chips = [
    { label: "Songs", value: s?.songs }, { label: "Karaoke", value: s?.karaoke },
    { label: "Videos", value: s?.videos }, { label: "Followers", value: s?.followers },
  ];

  useEffect(() => { document.title = `${artist.name} — Loveworld Music+`; }, [artist.name]);

  return (
    <div className="pb-28">
      <ArtistHero artist={artist} />
      <div className="px-4 max-w-4xl mx-auto">
        <ul className="grid grid-cols-4 gap-2 mt-4" aria-label="Artist statistics">
          {chips.map((c) => (
            <li key={c.label} className="glass-card rounded-2xl py-3 text-center">
              <p className="text-lg font-bold text-foreground tabular-nums h-7">{c.value === undefined ? "–" : compactNumber(c.value)}</p>
              <p className="text-[11px] text-muted-foreground">{c.label}</p>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3 mt-5">
          <Button onClick={() => playAll()} className="h-14 w-14 rounded-full gradient-gold text-primary-foreground glow-gold" aria-label={`Play ${artist.name}`}>
            <Play className="w-6 h-6 fill-current" />
          </Button>
          <Button variant="outline" onClick={() => playAll(true)} className="h-11 rounded-full" aria-label="Shuffle play"><Shuffle className="w-4 h-4" /></Button>
          <Button variant={following.data ? "outline" : "default"} onClick={toggleFollow} className="h-11 rounded-full px-5" aria-pressed={!!following.data}>
            {following.data ? "Following" : "Follow"}
          </Button>
          <ShareMenu url={buildShareUrl(`/artist/${artist.slug}`)} title={artist.name} imageUrl={artist.image_url || undefined}
            trigger={<Button variant="ghost" className="h-11 w-11 rounded-full" aria-label="Share artist"><Share2 className="w-5 h-5" /></Button>} />
        </div>

        {artist.description && (
          <section className="mt-6 glass-card rounded-2xl p-4">
            <h2 className="font-display text-lg text-foreground mb-2">About</h2>
            <p className={`text-sm text-muted-foreground whitespace-pre-line ${expanded ? "" : "line-clamp-4"}`}>{artist.description}</p>
            {artist.description.length > 220 && (
              <button className="text-gold text-sm mt-2 min-h-[44px]" onClick={() => setExpanded((v) => !v)}>{expanded ? "Show less" : "Read more"}</button>
            )}
          </section>
        )}

        <div role="tablist" className="flex gap-2 mt-6" aria-label="Artist content">
          {([["songs", "Songs", Music], ["karaoke", "Karaoke", Mic2], ["videos", "Videos", Video]] as const).map(([k, l, Icon]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={`min-h-[44px] px-4 rounded-full text-sm font-semibold inline-flex items-center gap-2 ${tab === k ? "gradient-gold text-primary-foreground" : "glass-card text-foreground"}`}>
              <Icon className="w-4 h-4" aria-hidden />{l}
            </button>
          ))}
        </div>

        <div role="tabpanel" className="mt-4 min-h-[300px]">
          {songs.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
          ) : !list.length ? (
            <p className="text-muted-foreground text-sm py-10 text-center">Nothing here yet.</p>
          ) : tab === "videos" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {list.slice(0, 120).map((song, i) => (
                <button key={song.id} onClick={() => playRow(i)} className="text-left group">
                  <div className="aspect-video rounded-xl overflow-hidden bg-muted relative">
                    {song.cover_url && <img src={song.cover_url} alt="" loading="lazy" className="w-full h-full object-cover" />}
                    <Play className="absolute inset-0 m-auto w-8 h-8 text-foreground drop-shadow" aria-hidden />
                  </div>
                  <p className="text-sm text-foreground truncate mt-1">{song.title}</p>
                </button>
              ))}
            </div>
          ) : (
            <ol className="space-y-1">
              {list.slice(0, 200).map((song, i) => (
                <li key={song.id}>
                  <button onClick={() => playRow(i)} className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-muted/40 text-left min-h-[56px]">
                    <span className="w-6 text-right text-sm text-muted-foreground tabular-nums">{i + 1}</span>
                    {song.cover_url ? <img src={song.cover_url} alt="" loading="lazy" className="w-12 h-12 rounded-lg object-cover" /> : <div className="w-12 h-12 rounded-lg bg-muted" />}
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-foreground truncate">{song.title}</span>
                      <span className="block text-xs text-muted-foreground">{compactNumber(song.play_count)} plays</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
};

export default ArtistProfile;
