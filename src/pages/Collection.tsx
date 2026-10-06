import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer } from "@/contexts/PlayerContext";
import { SONG_COLUMNS, toPlayerSong, type SongRow } from "@/lib/homeSongs";
import { ArrowLeft, ListMusic, Music2, Play, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Collection of recommended songs behind a home recommendation card. */
const Collection = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { playQueue, currentSong } = usePlayer();
  const [name, setName] = useState("");
  const [cover, setCover] = useState<string | null>(null);
  const [songs, setSongs] = useState<SongRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    supabase.from("playlists").select(`name,cover_url,playlist_songs(sort_order,songs(${SONG_COLUMNS}))`).eq("id", id).maybeSingle()
      .then(({ data }) => {
        const d = data as any;
        setName(d?.name || "Collection");
        const rows = ((d?.playlist_songs || []) as any[]).sort((a, b) => a.sort_order - b.sort_order).map((x) => x.songs).filter(Boolean) as SongRow[];
        setSongs(rows);
        setCover(d?.cover_url || rows[0]?.cover_url || null);
        setLoading(false);
      });
  }, [id]);

  const queue = songs.map(toPlayerSong);

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"><ArrowLeft className="w-4 h-4" /> Back</button>
        <div className="flex items-end gap-4 mb-6">
          <div className="w-32 h-32 rounded-2xl overflow-hidden bg-muted shadow-xl flex-shrink-0">
            {cover ? <img src={cover} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full gradient-purple flex items-center justify-center"><ListMusic className="w-10 h-10 text-gold/60" /></div>}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.2em] text-gold/80">Recommended</p>
            <h1 className="text-2xl font-serif font-bold text-foreground">{name}</h1>
            <p className="text-xs text-muted-foreground">{songs.length} songs</p>
          </div>
        </div>
        {songs.length > 0 && (
          <div className="flex gap-2 mb-4">
            <Button onClick={() => playQueue(queue)} className="gradient-gold text-primary-foreground gap-1"><Play className="w-4 h-4" fill="currentColor" /> Play</Button>
            <Button variant="outline" onClick={() => playQueue([...queue].sort(() => Math.random() - 0.5))} className="gap-1"><Shuffle className="w-4 h-4" /> Shuffle</Button>
          </div>
        )}
        {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
          <div className="space-y-1">
            {songs.map((s, i) => (
              <button key={s.id} onClick={() => playQueue(queue, i)} className={`flex items-center gap-3 w-full p-2 rounded-xl text-left transition-colors ${currentSong?.id === s.id ? "bg-muted/80" : "hover:bg-muted/40"}`}>
                <div className="w-11 h-11 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                  {s.cover_url ? <img src={s.cover_url} alt="" loading="lazy" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Music2 className="w-4 h-4 text-gold/50" /></div>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm truncate ${currentSong?.id === s.id ? "text-gold" : "text-foreground"}`}>{s.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{s.artist}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="h-8" />
    </AppLayout>
  );
};

export default Collection;
