import { useEffect, useRef, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer } from "@/contexts/PlayerContext";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, Mic2, Play, Volume2, VolumeX, Film } from "lucide-react";
import { EmptyState } from "@/components/ui/loading-skeleton";
import { SONG_COLUMNS, toPlayerSong, type SongRow } from "@/lib/homeSongs";
import ShareMenu, { buildShareUrl } from "@/components/share/ShareMenu";
import { toast } from "sonner";

type MomentRow = {
  id: string;
  video_url: string;
  video_type: string;
  thumbnail_url: string | null;
  songs: SongRow;
};

const TYPE_LABEL: Record<string, string> = {
  official: "Official",
  lyric: "Lyric Video",
  live: "Live",
  karaoke: "Karaoke",
};

const isYouTube = (url: string) => /youtube\.com|youtu\.be/.test(url);

const MomentCard = ({
  moment,
  isActive,
}: {
  moment: MomentRow;
  isActive: boolean;
}) => {
  const { singThis, playVideo, currentSong } = usePlayer();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [liked, setLiked] = useState(false);

  const song = moment.songs;
  const yt = isYouTube(moment.video_url);
  const poster = moment.thumbnail_url || song.cover_url || undefined;

  // Auto play/pause as the moment scrolls in and out of view.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || yt) return;
    if (isActive) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [isActive, yt]);

  // Check favorite state
  useEffect(() => {
    if (!user) return;
    supabase
      .from("favorites")
      .select("id")
      .eq("user_id", user.id)
      .eq("song_id", song.id)
      .maybeSingle()
      .then(({ data }) => setLiked(!!data));
  }, [user, song.id]);

  const toggleLike = async () => {
    if (!user) {
      toast.error("Sign in to like songs");
      return;
    }
    if (liked) {
      await supabase.from("favorites").delete().eq("song_id", song.id).eq("user_id", user.id);
      setLiked(false);
    } else {
      await supabase.from("favorites").insert({ song_id: song.id, user_id: user.id });
      setLiked(true);
    }
    queryClient.invalidateQueries({ queryKey: ["library-favorites"] });
  };

  const isCurrent = currentSong?.id === song.id;

  return (
    <div className="relative h-[100dvh] w-full snap-start snap-always flex items-center justify-center bg-black overflow-hidden">
      {/* Video / poster */}
      {yt ? (
        <button
          onClick={() => playVideo(toPlayerSong(song))}
          className="absolute inset-0 w-full h-full"
          aria-label={`Watch ${song.title}`}
        >
          {poster ? (
            <img src={poster} alt={song.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-muted" />
          )}
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-[0_0_30px_rgba(251,191,36,0.5)]">
              <Play className="w-7 h-7 text-slate-950 ml-1" fill="currentColor" />
            </div>
          </div>
        </button>
      ) : (
        <video
          ref={videoRef}
          src={moment.video_url}
          poster={poster}
          loop
          muted={muted}
          playsInline
          preload={isActive ? "auto" : "metadata"}
          className="absolute inset-0 w-full h-full object-contain"
          onClick={() => setMuted((m) => !m)}
        />
      )}

      {/* Gradient scrims */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/70 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/80 to-transparent" />

      {/* Right rail actions */}
      <div className="absolute right-3 bottom-44 flex flex-col items-center gap-5 z-10">
        <button
          onClick={toggleLike}
          aria-label={liked ? "Unlike" : "Like"}
          className="flex flex-col items-center gap-1"
        >
          <div className="w-11 h-11 rounded-full bg-black/50 backdrop-blur-xl border border-white/10 flex items-center justify-center">
            <Heart
              className={`w-5 h-5 transition-colors ${liked ? "text-amber-400" : "text-white"}`}
              fill={liked ? "currentColor" : "none"}
            />
          </div>
          <span className="text-[10px] text-white/80">Like</span>
        </button>

        <button
          onClick={() => singThis(toPlayerSong(song))}
          aria-label="Sing this song"
          className="flex flex-col items-center gap-1"
        >
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-[0_0_20px_rgba(251,191,36,0.4)]">
            <Mic2 className="w-5 h-5 text-slate-950" />
          </div>
          <span className="text-[10px] text-white/80">Sing This</span>
        </button>

        <ShareMenu
          url={buildShareUrl("/videos")}
          title={`${song.title} — ${song.artist}`}
          text={`Watch "${song.title}" on Loveworld Music Karaoke+`}
          kingschatFirst
          trigger={
            <div className="flex flex-col items-center gap-1">
              <div className="w-11 h-11 rounded-full bg-black/50 backdrop-blur-xl border border-white/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
              </div>
              <span className="text-[10px] text-white/80">Share</span>
            </div>
          }
        />

        {!yt && (
          <button
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? "Unmute" : "Mute"}
            className="flex flex-col items-center gap-1"
          >
            <div className="w-11 h-11 rounded-full bg-black/50 backdrop-blur-xl border border-white/10 flex items-center justify-center">
              {muted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-amber-400" />}
            </div>
            <span className="text-[10px] text-white/80">{muted ? "Unmute" : "Sound on"}</span>
          </button>
        )}
      </div>

      {/* Bottom info */}
      <div className="absolute left-4 right-20 bottom-36 z-10">
        <span className="inline-block text-[10px] font-semibold uppercase tracking-wide bg-black/60 backdrop-blur px-2 py-0.5 rounded-full text-amber-300 mb-2">
          {TYPE_LABEL[moment.video_type] || "Video"}
        </span>
        <p className="text-base font-serif font-bold text-white truncate">{song.title}</p>
        <p className="text-xs text-white/70 truncate">{song.artist}</p>
        {isCurrent && (
          <span className="inline-block mt-1 text-[10px] font-semibold bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full">
            Playing
          </span>
        )}
      </div>
    </div>
  );
};

const Moments = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const { data: moments = [], isLoading } = useQuery({
    queryKey: ["moments-feed"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("song_videos")
        .select(`id, video_url, video_type, thumbnail_url, songs!inner(${SONG_COLUMNS})`)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data as unknown as MomentRow[]) || []).filter((m) => m.songs);
    },
  });

  // Track which moment is mostly on screen.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const cards = Array.from(container.children) as HTMLElement[];
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const idx = cards.indexOf(e.target as HTMLElement);
            if (idx >= 0) setActiveIndex(idx);
          }
        });
      },
      { root: container, threshold: 0.6 }
    );
    cards.forEach((c) => observer.observe(c));
    return () => observer.disconnect();
  }, [moments.length]);

  return (
    <AppLayout>
      <div
        ref={containerRef}
        className="h-[100dvh] w-full overflow-y-scroll snap-y snap-mandatory scrollbar-none"
        style={{ scrollbarWidth: "none" }}
      >
        {isLoading ? (
          <div className="h-[100dvh] flex items-center justify-center bg-black">
            <div className="w-10 h-10 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
          </div>
        ) : moments.length === 0 ? (
          <div className="h-[100dvh] flex items-center justify-center bg-background px-6">
            <EmptyState
              icon={Film}
              title="No moments yet"
              description="Video moments will appear here as videos are added to songs."
            />
          </div>
        ) : (
          moments.map((m, i) => (
            <MomentCard key={m.id} moment={m} isActive={i === activeIndex} />
          ))
        )}
      </div>
    </AppLayout>
  );
};

export default Moments;
