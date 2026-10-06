import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer } from "@/contexts/PlayerContext";
import { useQuery } from "@tanstack/react-query";
import { Play, Search, Video as VideoIcon, Clapperboard } from "lucide-react";
import { SongRowSkeleton, EmptyState } from "@/components/ui/loading-skeleton";
import { SONG_COLUMNS, toPlayerSong, type SongRow } from "@/lib/homeSongs";

type VideoSongRow = SongRow & {
  song_videos: { video_type: string; thumbnail_url: string | null }[];
};

const TYPE_LABEL: Record<string, string> = {
  official: "Official",
  lyric: "Lyric Video",
  live: "Live",
  karaoke: "Karaoke",
};

const Videos = () => {
  const { playVideo, currentSong } = usePlayer();
  const [search, setSearch] = useState("");

  const { data: songs = [], isLoading } = useQuery({
    queryKey: ["videos-hub"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("songs")
        .select(`${SONG_COLUMNS}, song_videos!inner(video_type, thumbnail_url)`)
        .eq("has_video", true)
        .eq("song_videos.is_active", true)
        .order("title");
      if (error) throw error;
      // Dedupe: a song with several videos appears once per video row.
      const seen = new Set<string>();
      return ((data as VideoSongRow[] | null) || []).filter((s) => {
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      });
    },
  });

  const q = search.trim().toLowerCase();
  const filtered = q
    ? songs.filter((s) => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q))
    : songs;

  const formatDuration = (sec: number) => `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, "0")}`;

  return (
    <AppLayout>
      <div className="px-4 md:px-8 py-6 pb-32 max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-[0_0_20px_rgba(251,191,36,0.35)]">
            <Clapperboard className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-serif font-bold text-foreground">Videos</h1>
            <p className="text-xs text-muted-foreground">Watch official videos, lyric videos and live sessions</p>
          </div>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search videos…"
            className="w-full bg-card/60 backdrop-blur-xl border border-border/50 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-400/40"
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <SongRowSkeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={VideoIcon}
            title={q ? "No videos match your search" : "No videos yet"}
            description={q ? "Try a different song or artist name." : "Videos added to songs will appear here."}
          />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map((song) => {
              const thumb = song.song_videos.find((v) => v.thumbnail_url)?.thumbnail_url || song.cover_url;
              const typeLabel = TYPE_LABEL[song.song_videos[0]?.video_type] || "Video";
              const isCurrent = currentSong?.id === song.id;
              return (
                <button
                  key={song.id}
                  onClick={() => playVideo(toPlayerSong(song))}
                  className="group text-left rounded-2xl overflow-hidden bg-card/60 backdrop-blur-xl border border-border/50 hover:border-amber-400/40 transition-all hover:shadow-[0_0_24px_rgba(251,191,36,0.15)]"
                >
                  <div className="relative aspect-video bg-muted">
                    {thumb ? (
                      <img src={thumb} alt={song.title} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <VideoIcon className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-[0_0_20px_rgba(251,191,36,0.5)]">
                        <Play className="w-5 h-5 text-foreground ml-0.5" fill="currentColor" />
                      </div>
                    </div>
                    <span className="absolute top-2 left-2 text-[10px] font-semibold uppercase tracking-wide bg-black/60 backdrop-blur px-2 py-0.5 rounded-full text-amber-300">
                      {typeLabel}
                    </span>
                    <span className="absolute bottom-2 right-2 text-[10px] font-medium bg-black/60 backdrop-blur px-1.5 py-0.5 rounded text-white">
                      {formatDuration(song.duration_seconds)}
                    </span>
                    {isCurrent && (
                      <span className="absolute top-2 right-2 text-[10px] font-semibold bg-amber-400 text-foreground px-2 py-0.5 rounded-full">
                        Playing
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-semibold text-foreground truncate">{song.title}</p>
                    <p className="text-xs text-foreground truncate">{song.artist}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Videos;
