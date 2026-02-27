import { useState, useEffect, useCallback } from "react";
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, Volume2, VolumeX, Mic2, ListMusic, ChevronUp, X, Download, Check, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useIsPremium } from "@/hooks/useIsPremium";
import { isDownloaded, saveDownload, type DownloadedTrack } from "@/lib/downloadManager";
import { toast } from "sonner";
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
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { isPremium } = useIsPremium();
  const [hidden, setHidden] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const canDownload = isAdmin || isPremium;

  useEffect(() => {
    if (!currentSong) { setDownloaded(false); return; }
    isDownloaded(currentSong.id).then(setDownloaded);
  }, [currentSong?.id]);

  const handleDownload = useCallback(async () => {
    if (!currentSong?.audioUrl) { toast.error("No audio available"); return; }
    if (!canDownload && !(currentSong as any).isFreeDownload) {
      toast.info("Upgrade to Premium to download tracks");
      return;
    }
    setDownloading(true);
    try {
      await saveDownload(currentSong.id, currentSong.audioUrl, {
        id: currentSong.id,
        title: currentSong.title,
        artist: currentSong.artist,
        coverUrl: currentSong.coverUrl,
        lyricsLrc: currentSong.lyricsLrc,
        durationSeconds: currentSong.durationSeconds || 0,
        album: currentSong.album,
        downloadedAt: Date.now(),
      }, currentSong.instrumentalUrl);
      setDownloaded(true);
      toast.success(`"${currentSong.title}" saved for offline`);
    } catch (err: any) {
      toast.error("Download failed: " + (err.message || "Unknown error"));
    } finally {
      setDownloading(false);
    }
  }, [currentSong, canDownload]);

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
      <div className="fixed left-0 right-0 z-30 glass border-t border-border gpu lg:left-64 lg:bottom-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))]">
        <div className="px-5 pt-2">
          <div className="relative w-[96%] mx-auto group/progress">
            <Slider
              value={[progress]}
              onValueChange={([v]) => seekTo(v)}
              max={100}
              step={0.5}
              className="w-full [&_.relative]:h-1 [&_[class*=Range]]:bg-gradient-to-r [&_[class*=Range]]:from-gold [&_[class*=Range]]:via-gold-light [&_[class*=Range]]:to-gold [&_[class*=Track]]:h-1 [&_[class*=Track]]:bg-muted-foreground/20 [&_[class*=Thumb]]:w-[7px] [&_[class*=Thumb]]:h-[7px] [&_[class*=Thumb]]:bg-gold [&_[class*=Thumb]]:border-0 [&_[class*=Thumb]]:shadow-[0_0_8px_hsl(43_70%_53%/0.6)] [&_[class*=Thumb]]:opacity-0 [&_[class*=Thumb]]:group-hover/progress:opacity-100 [&_[class*=Thumb]]:transition-opacity"
            />
          </div>
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
            {/* Mobile download button */}
            <div className="md:hidden">
              {currentSong?.audioUrl && (
                downloaded ? (
                  <span className="text-green-500"><Check className="w-4 h-4" /></span>
                ) : canDownload ? (
                  <button onClick={handleDownload} disabled={downloading} className="text-muted-foreground">
                    <Download className={`w-4 h-4 ${downloading ? "animate-pulse text-gold" : ""}`} />
                  </button>
                ) : (
                  <button onClick={() => toast.info("Upgrade to Premium to download")} className="text-gold/50">
                    <Lock className="w-3.5 h-3.5" />
                  </button>
                )
              )}
            </div>
            <button onClick={toggleShuffle} className={`hidden md:block transition-colors ${shuffleOn ? "text-gold" : "text-muted-foreground hover:text-foreground"}`}>
              <Shuffle className="w-4 h-4" />
            </button>
            <button onClick={skipPrev} className="text-muted-foreground hover:text-foreground transition-colors">
              <SkipBack className="w-5 h-5" />
            </button>
            <button onClick={togglePlay}
              className="w-11 h-11 rounded-full bg-gradient-to-br from-gold via-gold-light to-gold flex items-center justify-center text-primary-foreground shadow-[0_4px_20px_hsl(43_70%_53%/0.5)] ring-2 ring-white/20 hover:scale-105 active:scale-95 transition-all duration-200">
              {isPlaying ? <Pause className="w-5 h-5 text-white drop-shadow-sm" fill="currentColor" /> : <Play className="w-5 h-5 text-white ml-0.5 drop-shadow-sm" fill="currentColor" />}
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
            {/* Download button */}
            {currentSong?.audioUrl && (
              downloaded ? (
                <span className="text-green-500"><Check className="w-4 h-4" /></span>
              ) : canDownload ? (
                <button onClick={handleDownload} disabled={downloading} className="text-muted-foreground hover:text-foreground transition-colors">
                  <Download className={`w-4 h-4 ${downloading ? "animate-pulse text-gold" : ""}`} />
                </button>
              ) : (
                <button onClick={() => toast.info("Upgrade to Premium to download")} className="text-gold/50">
                  <Lock className="w-4 h-4" />
                </button>
              )
            )}
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
                <span className="text-xs text-muted-foreground tabular-nums">{formatTime(song.durationSeconds || 0)}</span>
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