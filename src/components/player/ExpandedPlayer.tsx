import { usePlayer } from "@/contexts/PlayerContext";
import { ChevronDown, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Mic2, Music, Heart } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { useRef, useEffect, useState } from "react";

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

const ExpandedPlayer = () => {
  const {
    currentSong, isPlaying, isKaraoke, progress, duration, currentTime,
    lrcLines, activeLrcIndex, togglePlay, toggleKaraoke, toggleExpanded, seekTo,
  } = usePlayer();
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const [showLyrics, setShowLyrics] = useState(true);

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

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden">
      {/* Background gradient from album art */}
      <div className="absolute inset-0 gradient-purple" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/80 to-background" />

      {/* Content */}
      <div className="relative flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0">
          <button onClick={toggleExpanded} className="text-muted-foreground hover:text-foreground transition-colors p-1">
            <ChevronDown className="w-7 h-7" />
          </button>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-medium">Now Playing</p>
          </div>
          <button className="text-muted-foreground hover:text-gold transition-colors p-1">
            <Heart className="w-5 h-5" />
          </button>
        </div>

        {/* Toggle: Album Art / Lyrics */}
        {!showLyrics ? (
          /* Album Art View */
          <div className="flex-1 flex flex-col items-center justify-center px-8 min-h-0">
            <button onClick={() => setShowLyrics(true)} className="w-full max-w-[280px] aspect-square">
              <div className="w-full h-full rounded-3xl gradient-purple flex items-center justify-center glow-gold shadow-2xl">
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
            </div>
          </div>
        ) : (
          /* Lyrics View */
          <div className="flex-1 flex flex-col min-h-0">
            {/* Song info compact */}
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
        <div className="flex-shrink-0 px-6 pb-6 pt-2">
          {/* Progress */}
          <div className="mb-4">
            <Slider value={[progress]} onValueChange={([v]) => seekTo(v)} max={100} step={0.5} className="w-full mb-1.5" />
            <div className="flex justify-between text-[11px] text-muted-foreground font-medium">
              <span>{formatTime(currentTime)}</span>
              <span>-{formatTime(Math.max(0, duration - currentTime))}</span>
            </div>
          </div>

          {/* Playback Controls */}
          <div className="flex items-center justify-center gap-8">
            <button className="text-muted-foreground hover:text-foreground transition-colors">
              <Shuffle className="w-5 h-5" />
            </button>
            <button className="text-foreground hover:text-gold transition-colors">
              <SkipBack className="w-7 h-7" />
            </button>
            <button
              onClick={togglePlay}
              className="w-18 h-18 rounded-full gradient-gold flex items-center justify-center text-primary-foreground hover:opacity-90 transition-all shadow-lg glow-gold"
              style={{ width: 72, height: 72 }}
            >
              {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
            </button>
            <button className="text-foreground hover:text-gold transition-colors">
              <SkipForward className="w-7 h-7" />
            </button>
            <button className="text-muted-foreground hover:text-foreground transition-colors">
              <Repeat className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExpandedPlayer;
