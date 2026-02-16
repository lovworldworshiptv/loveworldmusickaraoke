import { usePlayer } from "@/contexts/PlayerContext";
import { ChevronDown, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Mic2, Music } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { useRef, useEffect } from "react";

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
  const lyricsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (lyricsRef.current && activeLrcIndex >= 0) {
      const el = lyricsRef.current.children[activeLrcIndex] as HTMLElement;
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeLrcIndex]);

  if (!currentSong) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={toggleExpanded} className="text-muted-foreground hover:text-foreground">
          <ChevronDown className="w-6 h-6" />
        </button>
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Now Playing</p>
        <div className="w-6" />
      </div>

      {/* Album Art */}
      <div className="px-8 mb-6">
        <div className="aspect-square max-w-xs mx-auto rounded-2xl gradient-purple flex items-center justify-center glow-gold">
          <Music className="w-20 h-20 text-gold opacity-40" />
        </div>
      </div>

      {/* Song Info */}
      <div className="px-6 mb-4 text-center">
        <h2 className="text-xl font-serif font-bold text-foreground truncate">{currentSong.title}</h2>
        <p className="text-sm text-muted-foreground">{currentSong.artist}</p>
      </div>

      {/* Karaoke Toggle */}
      <div className="flex justify-center gap-2 mb-4 px-6">
        <button
          onClick={toggleKaraoke}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all ${
            !isKaraoke ? "gradient-gold text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}>
          <Music className="w-3.5 h-3.5" /> Full Song
        </button>
        <button
          onClick={toggleKaraoke}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all ${
            isKaraoke ? "gradient-gold text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}>
          <Mic2 className="w-3.5 h-3.5" /> Karaoke
        </button>
      </div>

      {/* Lyrics */}
      <div ref={lyricsRef} className="flex-1 overflow-y-auto px-6 scrollbar-hide">
        {lrcLines.length > 0 ? (
          <div className="space-y-3 py-4">
            {lrcLines.map((line, i) => (
              <p key={i} className={`text-center font-serif transition-all duration-300 ${
                i === activeLrcIndex
                  ? "text-lg font-bold text-gold scale-105"
                  : i < activeLrcIndex
                  ? "text-sm text-muted-foreground/50"
                  : "text-sm text-muted-foreground"
              }`}>
                {line.text}
              </p>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground text-sm py-8">No lyrics available</p>
        )}
      </div>

      {/* Progress */}
      <div className="px-6 pt-4">
        <Slider value={[progress]} onValueChange={([v]) => seekTo(v)} max={100} step={0.5} className="w-full mb-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-6 py-6">
        <button className="text-muted-foreground hover:text-foreground"><Shuffle className="w-5 h-5" /></button>
        <button className="text-foreground hover:text-gold"><SkipBack className="w-6 h-6" /></button>
        <button onClick={togglePlay}
          className="w-16 h-16 rounded-full gradient-gold flex items-center justify-center text-primary-foreground hover:opacity-90 transition-opacity">
          {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-1" />}
        </button>
        <button className="text-foreground hover:text-gold"><SkipForward className="w-6 h-6" /></button>
        <button className="text-muted-foreground hover:text-foreground"><Repeat className="w-5 h-5" /></button>
      </div>
    </div>
  );
};

export default ExpandedPlayer;
