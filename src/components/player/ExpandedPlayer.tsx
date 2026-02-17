import { usePlayer, RepeatMode } from "@/contexts/PlayerContext";
import { ChevronDown, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, Mic2, Music, Heart, Volume, Volume2, Share2, ListMusic, X } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { useRef, useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

// Extract dominant color from image via canvas sampling
function useDominantColor(imageUrl?: string) {
  const [color, setColor] = useState<string | null>(null);

  useEffect(() => {
    if (!imageUrl) { setColor(null); return; }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 50;
        canvas.height = 50;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, 50, 50);
        const data = ctx.getImageData(0, 0, 50, 50).data;
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 16) {
          r += data[i]; g += data[i + 1]; b += data[i + 2]; count++;
        }
        r = Math.round(r / count); g = Math.round(g / count); b = Math.round(b / count);
        setColor(`${r}, ${g}, ${b}`);
      } catch {
        setColor(null);
      }
    };
    img.onerror = () => setColor(null);
    img.src = imageUrl;
  }, [imageUrl]);

  return color;
}

const ExpandedPlayer = () => {
  const {
    currentSong, isPlaying, isKaraoke, progress, duration, currentTime,
    lrcLines, activeLrcIndex, togglePlay, toggleKaraoke, toggleExpanded, seekTo,
    skipNext, skipPrev, repeatMode, cycleRepeat, shuffleOn, toggleShuffle,
    volume, setVolume, queue, queueIndex,
  } = usePlayer();
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const [showLyrics, setShowLyrics] = useState(true);
  const [showQueue, setShowQueue] = useState(false);
  const [isAnimating, setIsAnimating] = useState(true);

  const dominantColor = useDominantColor(currentSong?.coverUrl);
  const { user } = useAuth();
  const [isFav, setIsFav] = useState(false);

  // Slide-up animation on mount
  useEffect(() => {
    requestAnimationFrame(() => setIsAnimating(false));
  }, []);

  // Check if current song is favorited
  useEffect(() => {
    if (!user || !currentSong) { setIsFav(false); return; }
    supabase.from("favorites").select("id").eq("user_id", user.id).eq("song_id", currentSong.id).maybeSingle()
      .then(({ data }) => setIsFav(!!data));
  }, [user, currentSong?.id]);

  const toggleFavorite = async () => {
    if (!user || !currentSong) { toast.error("Sign in to add favorites"); return; }
    if (isFav) {
      await supabase.from("favorites").delete().eq("user_id", user.id).eq("song_id", currentSong.id);
      setIsFav(false);
      toast.success("Removed from favorites");
    } else {
      await supabase.from("favorites").insert({ user_id: user.id, song_id: currentSong.id });
      setIsFav(true);
      toast.success("Added to favorites");
    }
  };

  const handleShare = async () => {
    if (!currentSong) return;
    const shareData = {
      title: currentSong.title,
      text: `Listen to "${currentSong.title}" by ${currentSong.artist}`,
      url: window.location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.text} - ${shareData.url}`);
        toast.success("Link copied to clipboard");
      }
    } catch {}
  };

  const handleClose = () => {
    setIsAnimating(true);
    setTimeout(() => toggleExpanded(), 300);
  };

  // Smooth scroll active lyric to center
  useEffect(() => {
    if (!lyricsContainerRef.current || activeLrcIndex < 0) return;
    const el = lineRefs.current[activeLrcIndex];
    if (!el) return;

    const container = lyricsContainerRef.current;
    const containerHeight = container.clientHeight;
    const elTop = el.offsetTop;
    const elHeight = el.clientHeight;
    const scrollTarget = elTop - containerHeight / 2 + elHeight / 2;

    container.scrollTo({ top: scrollTarget, behavior: "smooth" });
  }, [activeLrcIndex]);

  if (!currentSong) return null;

  const getLineStyle = (index: number) => {
    const distance = Math.abs(index - activeLrcIndex);
    if (activeLrcIndex < 0) return "text-base text-muted-foreground/60";
    if (index === activeLrcIndex) return "text-2xl font-bold text-gold scale-[1.02] opacity-100";
    if (distance === 1) return "text-base text-foreground/60 opacity-80";
    if (distance === 2) return "text-sm text-muted-foreground/50 opacity-60";
    return "text-sm text-muted-foreground/30 opacity-40 blur-[0.5px]";
  };

  const RepeatIcon = repeatMode === "one" ? Repeat1 : Repeat;

  // Up Next songs (next 5 in queue after current)
  const upNextSongs = queue.slice(queueIndex + 1, queueIndex + 6);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col overflow-hidden transition-transform duration-300 ease-out ${isAnimating ? "translate-y-full" : "translate-y-0"}`}
    >
      {/* Background — solid, not transparent */}
      <div className="absolute inset-0 bg-background" />
      <div className="absolute inset-0" style={dominantColor ? { background: `linear-gradient(180deg, rgba(${dominantColor}, 0.35) 0%, hsl(var(--background)) 60%)` } : undefined}>
        {!dominantColor && <div className="absolute inset-0 gradient-purple opacity-30" />}
      </div>

      {/* Content */}
      <div className="relative flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0 safe-top">
          <button onClick={handleClose} className="text-muted-foreground hover:text-foreground transition-colors p-1">
            <ChevronDown className="w-7 h-7" />
          </button>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-medium">Now Playing</p>
          </div>
          <button onClick={() => setShowQueue(q => !q)} className={`transition-colors p-1 ${showQueue ? "text-gold" : "text-muted-foreground hover:text-foreground"}`}>
            <ListMusic className="w-5 h-5" />
          </button>
        </div>

        {/* Queue View */}
        {showQueue ? (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="px-6 pb-3 flex-shrink-0">
              <div className="flex items-center gap-3 w-full">
                <div className="w-12 h-12 rounded-xl gradient-purple flex-shrink-0 flex items-center justify-center glow-gold overflow-hidden">
                  {currentSong.coverUrl ? (
                    <img src={currentSong.coverUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Music className="w-6 h-6 text-gold/40" />
                  )}
                </div>
                <div className="text-left min-w-0">
                  <h2 className="text-base font-serif font-bold text-foreground truncate">{currentSong.title}</h2>
                  <p className="text-xs text-muted-foreground">{currentSong.artist}</p>
                </div>
              </div>
            </div>

            <div className="px-6 pb-2 flex-shrink-0">
              <h3 className="text-sm font-semibold text-foreground">Up Next</h3>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-hide px-4">
              {queue.map((song, i) => (
                <div
                  key={`${song.id}-${i}`}
                  className={`flex items-center gap-3 px-2 py-3 rounded-lg transition-colors ${
                    i === queueIndex
                      ? "bg-gold/10"
                      : "hover:bg-muted/40"
                  }`}
                >
                  <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                    {song.coverUrl ? (
                      <img src={song.coverUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Music className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm truncate ${i === queueIndex ? "text-gold font-semibold" : "text-foreground"}`}>{song.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                  </div>
                  {i === queueIndex && (
                    <div className="flex-shrink-0">
                      <Music className="w-4 h-4 text-gold animate-pulse" />
                    </div>
                  )}
                </div>
              ))}
              {queue.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-12">Queue is empty</p>
              )}
            </div>
          </div>
        ) : !showLyrics ? (
          /* Album Art View */
          <div className="flex-1 flex flex-col items-center justify-center px-8 min-h-0">
            <button onClick={() => setShowLyrics(true)} className="w-full max-w-[280px] aspect-square">
              <div className="w-full h-full rounded-3xl gradient-purple flex items-center justify-center glow-gold shadow-2xl overflow-hidden">
                {currentSong.coverUrl ? (
                  <img src={currentSong.coverUrl} alt={currentSong.title} className="w-full h-full rounded-3xl object-cover" />
                ) : (
                  <Music className="w-24 h-24 text-gold/30" />
                )}
              </div>
            </button>
            <div className="mt-8 text-center w-full px-4">
              <h2 className="text-2xl font-serif font-bold text-foreground truncate">{currentSong.title}</h2>
              <p className="text-base text-muted-foreground mt-1">{currentSong.artist}</p>
              {currentSong.album && <p className="text-xs text-muted-foreground/60 mt-0.5">{currentSong.album}</p>}
            </div>
          </div>
        ) : (
          /* Lyrics View */
          <div className="flex-1 flex flex-col min-h-0">
            <div className="px-6 pb-3 flex-shrink-0">
              <button onClick={() => setShowLyrics(false)} className="flex items-center gap-3 w-full">
                <div className="w-12 h-12 rounded-xl gradient-purple flex-shrink-0 flex items-center justify-center glow-gold overflow-hidden">
                  {currentSong.coverUrl ? (
                    <img src={currentSong.coverUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Music className="w-6 h-6 text-gold/40" />
                  )}
                </div>
                <div className="text-left min-w-0">
                  <h2 className="text-base font-serif font-bold text-foreground truncate">{currentSong.title}</h2>
                  <p className="text-xs text-muted-foreground">{currentSong.artist}</p>
                </div>
              </button>
            </div>

            {/* Karaoke Toggle */}
            <div className="flex justify-center gap-1.5 mb-3 px-6 flex-shrink-0">
              <button
                onClick={() => { if (isKaraoke) toggleKaraoke(); }}
                className={`flex items-center gap-1.5 px-5 py-2 rounded-full text-xs font-semibold transition-all duration-300 ${
                  !isKaraoke
                    ? "gradient-gold text-primary-foreground shadow-lg"
                    : "bg-secondary/60 text-muted-foreground hover:text-foreground"
                }`}>
                <Music className="w-3.5 h-3.5" /> Full Song
              </button>
              <button
                onClick={() => { if (!isKaraoke) toggleKaraoke(); }}
                className={`flex items-center gap-1.5 px-5 py-2 rounded-full text-xs font-semibold transition-all duration-300 ${
                  isKaraoke
                    ? "gradient-gold text-primary-foreground shadow-lg"
                    : "bg-secondary/60 text-muted-foreground hover:text-foreground"
                }`}>
                <Mic2 className="w-3.5 h-3.5" /> Karaoke
              </button>
            </div>

            {/* Synced Lyrics */}
            <div
              ref={lyricsContainerRef}
              className="flex-1 overflow-y-auto scrollbar-hide px-6 relative"
            >
              {lrcLines.length > 0 ? (
                <div className="py-[40vh] space-y-5">
                  {lrcLines.map((line, i) => (
                    <p
                      key={i}
                      ref={(el) => { lineRefs.current[i] = el; }}
                      onClick={() => {
                        if (duration > 0) seekTo((line.time / duration) * 100);
                      }}
                      className={`text-center font-serif leading-relaxed transition-all duration-500 ease-out cursor-pointer hover:opacity-100 ${getLineStyle(i)}`}
                    >
                      {line.text || "♪"}
                    </p>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Music className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground text-sm">No lyrics available</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bottom Controls */}
        <div className="flex-shrink-0 px-6 pt-2 safe-bottom" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
          {/* Progress */}
          <div className="mb-3">
            <Slider value={[progress]} onValueChange={([v]) => seekTo(v)} max={100} step={0.5} className="w-full mb-1.5" />
            <div className="flex justify-between text-[11px] text-muted-foreground font-medium">
              <span>{formatTime(currentTime)}</span>
              <span>-{formatTime(Math.max(0, duration - currentTime))}</span>
            </div>
          </div>

          {/* Playback Controls */}
          <div className="flex items-center justify-center gap-8 mb-3">
            <button onClick={toggleShuffle} className={`transition-colors ${shuffleOn ? "text-gold" : "text-muted-foreground hover:text-foreground"}`}>
              <Shuffle className="w-5 h-5" />
            </button>
            <button onClick={skipPrev} className="text-foreground hover:text-gold transition-colors active:scale-90">
              <SkipBack className="w-7 h-7" />
            </button>
            <button
              onClick={togglePlay}
              className="w-18 h-18 rounded-full gradient-gold flex items-center justify-center text-primary-foreground hover:opacity-90 transition-all shadow-lg glow-gold active:scale-95"
              style={{ width: 72, height: 72 }}
            >
              {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
            </button>
            <button onClick={skipNext} className="text-foreground hover:text-gold transition-colors active:scale-90">
              <SkipForward className="w-7 h-7" />
            </button>
            <button onClick={cycleRepeat} className={`relative transition-colors ${repeatMode !== "off" ? "text-gold" : "text-muted-foreground hover:text-foreground"}`}>
              <RepeatIcon className="w-5 h-5" />
              {repeatMode === "one" && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-gold" />
              )}
            </button>
          </div>

          {/* Volume Slider + Action Row (Apple Music style) */}
          <div className="flex items-center gap-3 mb-2">
            <Volume className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <Slider
              value={[volume * 100]}
              onValueChange={([v]) => setVolume(v / 100)}
              max={100}
              step={1}
              className="flex-1"
            />
            <Volume2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          </div>

          {/* Bottom action buttons: Favorite, Share */}
          <div className="flex items-center justify-center gap-8 pt-1">
            <button onClick={toggleFavorite} className={`transition-colors p-2 ${isFav ? "text-gold" : "text-muted-foreground hover:text-gold"}`}>
              <Heart className="w-5 h-5" fill={isFav ? "currentColor" : "none"} />
            </button>
            <button onClick={handleShare} className="text-muted-foreground hover:text-foreground transition-colors p-2">
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExpandedPlayer;
