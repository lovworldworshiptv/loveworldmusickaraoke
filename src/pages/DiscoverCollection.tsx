import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Music, Play, Mic2, Clapperboard } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer } from "@/contexts/PlayerContext";
import { fallbackImage } from "@/lib/discover";
import { SONG_COLUMNS, toPlayerSong, type SongRow } from "@/lib/homeSongs";

type Kind = "karaoke" | "videos" | "featured";

const db = supabase as any;

/** Discover listing: all karaoke songs, all video songs, or an admin-curated featured playlist. */
const DiscoverCollection = ({ kind }: { kind: Kind }) => {
  const { id } = useParams();
  const { playQueue, playVideoQueue, currentSong } = usePlayer();

  const { data, isLoading } = useQuery({
    queryKey: ["discover-collection", kind, id],
    queryFn: async () => {
      if (kind === "karaoke") {
        const { data } = await db.from("songs").select(SONG_COLUMNS).not("instrumental_url", "is", null).order("title");
        return { title: "Karaoke", subtitle: "Every song you can sing along to", cover: null, songs: (data || []) as SongRow[] };
      }
      if (kind === "videos") {
        const { data } = await db.from("songs").select(`${SONG_COLUMNS}, song_videos!inner(id)`)
          .eq("has_video", true).eq("song_videos.is_active", true).order("title");
        const seen = new Set<string>();
        const songs = ((data || []) as SongRow[]).filter((s) => !seen.has(s.id) && seen.add(s.id));
        return { title: "Videos", subtitle: "Every song with a video", cover: null, songs };
      }
      const { data: f } = await db.from("discover_featured").select("*").eq("id", id).maybeSingle();
      const ids: string[] = f?.song_ids || [];
      let songs: SongRow[] = [];
      if (ids.length) {
        const { data: rows } = await db.from("songs").select(SONG_COLUMNS).in("id", ids);
        const byId = new Map(((rows || []) as SongRow[]).map((r) => [r.id, r]));
        songs = ids.map((i) => byId.get(i)).filter(Boolean) as SongRow[];
      }
      return { title: f?.label || "Featured", subtitle: f?.description || null, cover: f?.image_url || f?.poster_url || null, songs };
    },
  });

  const songs = data?.songs || [];
  const queue = songs.map(toPlayerSong);
  const play = (i: number) =>
    kind === "videos" ? playVideoQueue(queue, i) : playQueue(queue, i, { karaoke: kind === "karaoke" });
  const Icon = kind === "karaoke" ? Mic2 : kind === "videos" ? Clapperboard : Play;
  const cover = data?.cover || songs[0]?.cover_url || fallbackImage(kind === "featured" ? data?.title || "" : kind);

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 lg:pt-6 max-w-3xl mx-auto text-foreground">
        <Link to="/discover" className="inline-flex items-center gap-1 text-sm mb-4"><ArrowLeft className="w-4 h-4" /> Discover</Link>
        <div className="relative h-48 rounded-2xl overflow-hidden mb-5">
          <img src={cover} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-3xl font-serif font-bold truncate">{data?.title || ""}</h1>
              {data?.subtitle && <p className="text-sm line-clamp-2">{data.subtitle}</p>}
              <p className="text-xs mt-1">
                {songs.length} songs
                {kind === "karaoke" && " · plays continuously in Karaoke mode"}
                {kind === "videos" && " · plays continuously in Video mode"}
              </p>
            </div>
            {queue.length > 0 && (
              <button onClick={() => play(0)} aria-label="Play all" className="w-12 h-12 flex-shrink-0 rounded-full gradient-gold flex items-center justify-center glow-gold hover:scale-105 transition-transform">
                <Icon className="w-5 h-5 text-foreground" />
              </button>
            )}
          </div>
        </div>
        {isLoading && <p className="text-sm">Loading…</p>}
        {!isLoading && songs.length === 0 && <p className="text-sm text-center py-8">No songs here yet.</p>}
        <div className="space-y-1">
          {queue.map((s, i) => (
            <button key={s.id} onClick={() => play(i)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/40 transition-colors text-left ${currentSong?.id === s.id ? "bg-gold/10" : ""}`}>
              <span className="w-5 text-xs text-center">{i + 1}</span>
              <div className="w-11 h-11 rounded-lg bg-primary/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                {s.coverUrl ? <img src={s.coverUrl} alt="" loading="lazy" className="w-full h-full object-cover" /> : <Music className="w-4 h-4 text-gold" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-sm truncate ${currentSong?.id === s.id ? "text-gold" : ""}`}>{s.title}</p>
                <p className="text-xs font-semibold truncate">{s.artist}</p>
              </div>
              {kind !== "featured" && <Icon className="w-4 h-4 text-gold flex-shrink-0" />}
            </button>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default DiscoverCollection;
