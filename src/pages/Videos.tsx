import { useState } from "react";
import DownloadButton from "@/components/offline/DownloadButton";
import { useSaveSong } from "@/hooks/useSaveSong";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer } from "@/contexts/PlayerContext";
import { useQuery } from "@tanstack/react-query";
import { Play, Search, Video as VideoIcon, Clapperboard } from "lucide-react";
import { SongRowSkeleton, EmptyState } from "@/components/ui/loading-skeleton";
import { SONG_COLUMNS, toPlayerSong, type SongRow } from "@/lib/homeSongs";
import { sortSongsByTitle } from "@/lib/utils";
import { fetchAllRows } from "@/lib/fetchAll";

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
  const { save, canSave } = useSaveSong();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  const { data: songs = [], isLoading } = useQuery({
    queryKey: ["videos-hub"],
    queryFn: async () => {
      // Paged so the list never stops at the backend's 1,000-row cap.
      const data = await fetchAllRows<VideoSongRow>((from, to) => supabase
        .from("songs")
        .select(`${SONG_COLUMNS}, song_videos!inner(video_type, thumbnail_url)`)
        .eq("has_video", true)
        .eq("song_videos.is_active", true)
        .order("id")
        .range(from, to) as unknown as PromiseLike<{ data: VideoSongRow[] | null; error: unknown }>);
      // Dedupe: a song with several videos appears once per video row.
      const seen = new Set<string>();
      const deduped = data.filter((s) => {
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      });
      return sortSongsByTitle(deduped);
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["video-filter-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("id,name");
      return data || [];
    },
  });

  const norm = (n: string) => n.toLowerCase().replace(/&/g, "and").replace(/[^a-z]/g, "");
  const catId = (label: string) => categories.find((c) => norm(c.name) === norm(label))?.id;

  const q = search.trim().toLowerCase();
  let filtered = q
    ? songs.filter((s) => s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q))
    : songs;
  if (filter !== "All" && filter !== "A-Z" && filter !== "Z-A") {
    const id = catId(filter);
    filtered = filtered.filter((s) => s.category_id === id);
  }
  if (filter === "Z-A") filtered = [...filtered].reverse();

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

        <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 mb-6 pb-1" role="group" aria-label="Filter videos">
          {["All", "Praise & Worship", "Healing", "Salvation", "Christmas", "Orchestra", "Medleys", "Communion", "A-Z", "Z-A"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold border backdrop-blur-xl transition-colors touch-manipulation ${
                filter === f
                  ? "bg-gradient-to-br from-amber-400 to-amber-600 text-foreground border-amber-400/60"
                  : "bg-card/60 text-foreground border-border/50"
              }`}
            >
              {f}
            </button>
          ))}
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
                <div key={song.id} className="relative">
                <button
                  onClick={() => playVideo(toPlayerSong(song))}
                  className="w-full group text-left rounded-2xl active:scale-[0.98] touch-manipulation overflow-hidden bg-card/60 backdrop-blur-xl border border-border/50 hover:border-amber-400/40 transition-all hover:shadow-[0_0_24px_rgba(251,191,36,0.15)]"
                >
                  <div className="relative aspect-video bg-muted overflow-hidden">
                    {thumb ? (
                      <>
                        <img src={thumb} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover blur-xl scale-110 opacity-60" />
                        <img src={thumb} alt={song.title} className="relative w-full h-full object-contain" loading="lazy" decoding="async" />
                      </>
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
                  <div className="p-3 pr-12">
                    <p className="text-sm font-semibold text-foreground truncate">{song.title}</p>
                    <p className="text-xs text-foreground truncate">{song.artist}</p>
                  </div>
                </button>
                {song.audio_url && (
                  <DownloadButton
                    songId={song.id}
                    title={song.title}
                    onDownload={() => save(toPlayerSong(song))}
                    needsPremium={!canSave(toPlayerSong(song))}
                    className="absolute bottom-2 right-1"
                  />
                )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Videos;
