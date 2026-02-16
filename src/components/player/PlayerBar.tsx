import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Volume2, Mic2, ListMusic, ChevronUp } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { usePlayer } from "@/contexts/PlayerContext";
import ExpandedPlayer from "./ExpandedPlayer";

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

const PlayerBar = () => {
  const { currentSong, isPlaying, isKaraoke, isExpanded, progress, currentTime, duration, togglePlay, toggleKaraoke, toggleExpanded, seekTo } = usePlayer();

  if (isExpanded) return <ExpandedPlayer />;

  return (
    <div className="fixed bottom-12 lg:bottom-0 left-0 lg:left-64 right-0 z-30 glass border-t border-border">
      <div className="px-4 pt-2">
        <Slider value={[progress]} onValueChange={([v]) => seekTo(v)} max={100} step={1} className="w-full h-1" />
      </div>

      <div className="flex items-center justify-between px-4 py-3">
        {/* Song Info */}
        <button onClick={toggleExpanded} className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-lg gradient-gold flex-shrink-0 flex items-center justify-center">
            {currentSong && <ChevronUp className="w-4 h-4 text-primary-foreground" />}
          </div>
          <div className="min-w-0 text-left">
            <p className="text-sm font-medium truncate text-foreground">{currentSong?.title || "No song selected"}</p>
            <p className="text-xs text-muted-foreground truncate">{currentSong?.artist || "Tap a song to play"}</p>
          </div>
        </button>

        {/* Controls */}
        <div className="flex items-center gap-2 md:gap-4">
          <button className="hidden md:block text-muted-foreground hover:text-foreground transition-colors">
            <Shuffle className="w-4 h-4" />
          </button>
          <button className="text-muted-foreground hover:text-foreground transition-colors">
            <SkipBack className="w-5 h-5" />
          </button>
          <button onClick={togglePlay}
            className="w-10 h-10 rounded-full gradient-gold flex items-center justify-center text-primary-foreground hover:opacity-90 transition-opacity">
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </button>
          <button className="text-muted-foreground hover:text-foreground transition-colors">
            <SkipForward className="w-5 h-5" />
          </button>
          <button className="hidden md:block text-muted-foreground hover:text-foreground transition-colors">
            <Repeat className="w-4 h-4" />
          </button>
        </div>

        {/* Right Controls */}
        <div className="hidden md:flex items-center gap-3 flex-1 justify-end">
          <button onClick={toggleKaraoke} className={`transition-opacity ${isKaraoke ? "text-gold" : "text-muted-foreground hover:text-foreground"}`}>
            <Mic2 className="w-4 h-4" />
          </button>
          <button className="text-muted-foreground hover:text-foreground transition-colors">
            <ListMusic className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 w-28">
            <Volume2 className="w-4 h-4 text-muted-foreground" />
            <Slider defaultValue={[70]} max={100} step={1} className="flex-1" />
          </div>
          <span className="text-xs text-muted-foreground w-16 text-right">{formatTime(currentTime)} / {formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
};

export default PlayerBar;
