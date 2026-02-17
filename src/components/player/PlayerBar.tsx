import { useState } from "react";
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, Volume2, VolumeX, Mic2, ListMusic, ChevronUp, X } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { usePlayer } from "@/contexts/PlayerContext";
import ExpandedPlayer from "./ExpandedPlayer";

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

const PlayerBar = () => {
  const {
    currentSong, isPlaying, isKaraoke, isExpanded, progress, currentTime, duration,
    togglePlay, toggleKaraoke, toggleExpanded, seekTo,
    skipNext, skipPrev, repeatMode, cycleRepeat, shuffleOn, toggleShuffle,
    volume, setVolume, queue, queueIndex,
  } = usePlayer();
  const [hidden, setHidden] = useState(false);
  const [showQueue, setShowQueue] = useState(false);

  if (!currentSong) return null;
  if (hidden) return (
    <button onClick={() => setHidden(false)} className="fixed z-30 w-12 h-12 rounded-full gradient-gold flex items-center justify-center text-primary-foreground shadow-lg hover:opacity-90 transition-opacity touch-target active:scale-95 lg:bottom-2 right-3" style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}>
      <ChevronUp className="w-5 h-5" />
    </button>
  );
  if (isExpanded) return <ExpandedPlayer />;

  const RepeatIcon = repeatMode === "one" ? Repeat1 : Repeat;
  const VolumeIcon = volume === 0 ? VolumeX : Volume2;

  return (
    <>
      <div className="fixed left-0 right-0 z-30 glass border-t border-border gpu lg:left-64 lg:bottom-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))]">
        <div className="px-4 pt-2">
          <Slider value={[progress]} onValueChange={([v]) => seekTo(v)} max={100} step={1} className="w-full h-1" />
        </div>

        <div className="flex items-center justify-between px-4 py-3">
          {/* Song Info */}
          <button onClick={toggleExpanded} className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-lg gradient-gold flex-shrink-0 flex items-center justify-center overflow-hidden">
              {currentSong?.coverUrl ? (
                <img src={currentSong.coverUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <ChevronUp className="w-4 h-4 text-primary-foreground" />
              )}
            </div>
            <div className="min-w-0 text-left">
              <p className="text-sm font-medium truncate text-foreground">{currentSong?.title || "No song selected"}</p>
              <p className="text-xs text-muted-foreground truncate">{currentSong?.artist || "Tap a song to play"}</p>
            </div>
          </button>

          {/* Controls */}
          <div className="flex items-center gap-2 md:gap-4">
            <button onClick={toggleShuffle} className={`hidden md:block transition-colors ${shuffleOn ? "text-gold" : "text-muted-foreground hover:text-foreground"}`}>
              <Shuffle className="w-4 h-4" />
            </button>
            <button onClick={skipPrev} className="text-muted-foreground hover:text-foreground transition-colors">
              <SkipBack className="w-5 h-5" />
            </button>
            <button onClick={togglePlay}
              className="w-10 h-10 rounded-full gradient-gold flex items-center justify-center text-primary-foreground hover:opacity-90 transition-opacity">
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>
            <button onClick={skipNext} className="text-muted-foreground hover:text-foreground transition-colors">
              <SkipForward className="w-5 h-5" />
            </button>
            <button onClick={cycleRepeat} className={`hidden md:block transition-colors ${repeatMode !== "off" ? "text-gold" : "text-muted-foreground hover:text-foreground"}`}>
              <RepeatIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Right Controls */}
          <div className="hidden md:flex items-center gap-3 flex-1 justify-end">
            <button onClick={toggleKaraoke} className={`transition-opacity ${isKaraoke ? "text-gold" : "text-muted-foreground hover:text-foreground"}`}>
              <Mic2 className="w-4 h-4" />
            </button>
            <button onClick={() => setShowQueue(q => !q)} className={`transition-colors ${showQueue ? "text-gold" : "text-muted-foreground hover:text-foreground"}`}>
              <ListMusic className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 w-28">
              <button onClick={() => setVolume(volume === 0 ? 0.7 : 0)}>
                <VolumeIcon className="w-4 h-4 text-muted-foreground" />
              </button>
              <Slider value={[volume * 100]} onValueChange={([v]) => setVolume(v / 100)} max={100} step={1} className="flex-1" />
            </div>
            <span className="text-xs text-muted-foreground w-16 text-right">{formatTime(currentTime)} / {formatTime(duration)}</span>
            <button onClick={() => setHidden(true)} className="text-muted-foreground hover:text-foreground transition-colors ml-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Queue Panel */}
      {showQueue && (
        <div className="fixed bottom-28 lg:bottom-20 right-4 z-40 w-80 max-h-96 rounded-xl border border-border bg-card shadow-2xl overflow-hidden animate-fade-in-up">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">Queue</h4>
            <button onClick={() => setShowQueue(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </div>
          <div className="overflow-y-auto max-h-80 scrollbar-hide">
            {queue.map((song, i) => (
              <div key={`${song.id}-${i}`} className={`flex items-center gap-3 px-4 py-2.5 text-sm ${i === queueIndex ? "bg-gold/10 text-gold" : "text-foreground hover:bg-muted/40"}`}>
                <span className="w-5 text-xs text-muted-foreground text-right">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{song.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{song.artist}</p>
                </div>
              </div>
            ))}
            {queue.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">Queue is empty</p>}
          </div>
        </div>
      )}
    </>
  );
};

export default PlayerBar;