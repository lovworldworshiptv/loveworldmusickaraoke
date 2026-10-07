import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Music, Play } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer, type PlayerSong } from "@/contexts/PlayerContext";
import { fallbackImage } from "@/lib/discover";

const toPlayer = (s: any): PlayerSong => ({
  id: s.id, title: s.title, artist: s.artist, album: s.album || undefined,
  coverUrl: s.cover_url || undefined, audioUrl: s.audio_url || undefined,
  instrumentalUrl: s.instrumental_url || undefined, lyricsLrc: s.lyrics_lrc || undefined,
  durationSeconds: s.duration_seconds,
});

const DiscoverTag = () => {
  const { tag = "" } = useParams();
  const { playQueue } = usePlayer();
  const isKaraoke = tag.toLowerCase().startsWith("karaoke");
  const term = tag.replace(/[^a-z0-9 ]/gi, "");

  const { data: songs = [], isLoading } = useQuery({
    queryKey: ["discover-tag", tag],
    queryFn: async () => {
      let q = (supabase.from("songs") as any).select("*").limit(50);
      q = isKaraoke ? q.not("instrumental_url", "is", null) : q.or(`title.ilike.%${term}%,album.ilike.%${term}%,lyrics_text.ilike.%${term}%,lyrics_lrc.ilike.%${term}%`);
      const { data } = await q.order("play_count", { ascending: false });
      return data || [];
    },
  });

  const queue = songs.map(toPlayer);

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 lg:pt-6 max-w-3xl mx-auto pb-28 lg:pb-32">
        <Link to="/discover" className="inline-flex items-center gap-1 text-sm text-foreground mb-4"><ArrowLeft className="w-4 h-4" /> Discover</Link>
        <div className="relative h-40 rounded-2xl overflow-hidden mb-5">
          <img src={fallbackImage(tag)} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
            <div>
              <h1 className="text-3xl font-serif font-bold text-foreground">#{tag}</h1>
              <p className="text-sm text-foreground">{songs.length} songs</p>
            </div>
            {queue.length > 0 && (
              <button onClick={() => playQueue(queue, 0)} aria-label="Play all" className="w-12 h-12 rounded-full gradient-gold flex items-center justify-center glow-gold">
                <Play className="w-5 h-5 text-foreground fill-current ml-0.5" />
              </button>
            )}
          </div>
        </div>
        {isLoading && <p className="text-sm text-foreground/70">Loading…</p>}
        {!isLoading && songs.length === 0 && <p className="text-sm text-foreground/80 text-center py-8">No songs found for #{tag} yet.</p>}
        <div className="space-y-1">
          {queue.map((s, i) => (
            <button key={s.id} onClick={() => playQueue(queue, i)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/40 transition-colors text-left">
              <div className="w-11 h-11 rounded-lg bg-primary/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                {s.coverUrl ? <img src={s.coverUrl} alt="" className="w-full h-full object-cover" /> : <Music className="w-4 h-4 text-gold" />}
              </div>
              <div className="min-w-0">
                <p className="text-sm text-foreground truncate">{s.title}</p>
                <p className="text-xs text-foreground font-semibold truncate">{s.artist}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default DiscoverTag;
