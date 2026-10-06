import { useDominantColor, playerTone } from "@/lib/dominantColor";
import { useState, useEffect, useCallback, useRef } from "react";
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, Volume2, VolumeX, Mic2, ListMusic, ChevronUp, X, Download, Check, Lock, Crown, Disc3, MoreVertical } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useIsPremium } from "@/hooks/useIsPremium";
import { supabase } from "@/integrations/supabase/client";
import { isDownloaded, saveDownload, type DownloadedTrack } from "@/lib/downloadManager";
import { toast } from "sonner";
import { usePlayer } from "@/contexts/PlayerContext";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import ExpandedPlayer from "./ExpandedPlayer";
import PlaybackProgress from "./PlaybackProgress";

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

interface PlayerBarProps {
  desktopSidebarCollapsed?: boolean;
}

const PlayerBar = ({ desktopSidebarCollapsed = false }: PlayerBarProps) => {
  const {
    currentSong, isPlaying, isKaraoke, isExpanded, progress, currentTime, duration,
    togglePlay, toggleKaraoke, toggleExpanded, seekTo,
    skipNext, skipPrev, repeatMode, cycleRepeat, shuffleOn, toggleShuffle,
    volume, setVolume, queue, queueIndex, trackEndCount,
  } = usePlayer();
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { isPremium } = useIsPremium();
  const navigate = useNavigate();
  const [hidden, setHidden] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const prevTrackEndRef = useRef(trackEndCount);
  const [recordFeatureEnabled, setRecordFeatureEnabled] = useState(true);

  useEffect(() => {
    supabase.from("app_settings" as any).select("value").eq("key", "karaoke_record_enabled").single()
      .then(({ data }: any) => {
        if (data) setRecordFeatureEnabled(data.value === true);
      });
  }, []);

  // Show premium modal after each track ends for free users
  useEffect(() => {
    if (trackEndCount > prevTrackEndRef.current && !isPremium && user) {
      setShowUpgrade(true);
    }
    prevTrackEndRef.current = trackEndCount;
  }, [trackEndCount, isPremium, user]);

  const canDownload = isPremium;

  useEffect(() => {
    if (!currentSong) { setDownloaded(false); return; }
    isDownloaded(currentSong.id).then(setDownloaded);
  }, [currentSong?.id]);

  const handleDownload = useCallback(async () => {
    if (!currentSong?.audioUrl) { toast.error("No audio available"); return; }
    if (!canDownload && !(currentSong as any).isFreeDownload) {
      setShowUpgrade(true);
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

  const tone = playerTone(useDominantColor(currentSong?.coverUrl), 90);
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
      <div style={tone ? { backgroundColor: `rgba(${tone}, 0.92)`, borderColor: `rgba(${tone}, 0.4)`, transition: "background-color 700ms ease, border-color 700ms ease" } : undefined} className={`fixed left-2 right-2 z-30 glass rounded-2xl border border-border gpu shadow-[0_12px_40px_-12px_rgba(0,0,0,0.6)] bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] lg:right-0 lg:bottom-0 lg:rounded-none lg:border-x-0 lg:border-b-0 lg:transition-[left] lg:duration-300 ${desktopSidebarCollapsed ? "lg:left-20" : "lg:left-64"}`}>
        <div className="px-4 pt-2">
          <div className="relative w-[96%] mx-auto group/progress">
            <PlaybackProgress value={progress} onValueChange={seekTo} ariaLabel="Song position" />
          </div>
        </div>

        <div className="flex items-center justify-between px-3.5 pb-1.5 pt-1.5">
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
              <p className="text-xs font-bold text-white truncate">{currentSong?.artist || "Tap a song to play"}</p>
            </div>
          </button>

          {/* Controls */}
          <div className="flex items-center gap-2 md:gap-4">
            {/* Mobile 3-dot menu */}
            <button onClick={toggleExpanded} className="md:hidden text-foreground hover:text-gold transition-colors">
              <MoreVertical className="w-5 h-5" />
            </button>
            <button onClick={toggleShuffle} className={`hidden md:block transition-colors ${shuffleOn ? "text-gold" : "text-foreground hover:text-gold"}`}>
              <Shuffle className="w-4 h-4" />
            </button>
            <button onClick={skipPrev} className="text-foreground hover:text-gold transition-colors">
              <SkipBack className="w-5 h-5" />
            </button>
            <button onClick={togglePlay}
              className="w-11 h-11 rounded-full bg-gradient-to-br from-gold via-gold-light to-gold flex items-center justify-center text-primary-foreground shadow-[0_4px_20px_hsl(43_70%_53%/0.5)] ring-2 ring-white/20 hover:scale-105 active:scale-95 transition-all duration-200">
              {isPlaying ? <Pause className="w-5 h-5 text-white drop-shadow-sm" fill="currentColor" /> : <Play className="w-5 h-5 text-white ml-0.5 drop-shadow-sm" fill="currentColor" />}
            </button>
            <button onClick={skipNext} className="text-foreground hover:text-gold transition-colors">
              <SkipForward className="w-5 h-5" />
            </button>
            <button onClick={cycleRepeat} className={`hidden md:block transition-colors ${repeatMode !== "off" ? "text-gold" : "text-foreground hover:text-gold"}`}>
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
                <button onClick={handleDownload} disabled={downloading} className="text-foreground hover:text-gold transition-colors">
                  <Download className={`w-4 h-4 ${downloading ? "animate-pulse text-gold" : ""}`} />
                </button>
              ) : (
                <button onClick={() => setShowUpgrade(true)} className="text-gold/50">
                  <Lock className="w-4 h-4" />
                </button>
              )
            )}
            <button onClick={toggleKaraoke} className={`transition-opacity ${isKaraoke ? "text-gold" : "text-foreground hover:text-gold"}`}>
              <Mic2 className="w-4 h-4" />
            </button>
            {recordFeatureEnabled && (
              isPremium ? (
                <button onClick={() => { if (!isExpanded) toggleExpanded(); }} className="text-destructive/70 hover:text-destructive transition-colors" title="Record Karaoke">
                  <Disc3 className="w-4 h-4" />
                </button>
              ) : (
                <button onClick={() => setShowUpgrade(true)} className="text-gold/60 hover:text-gold transition-colors" title="Premium: Record Karaoke">
                  <Disc3 className="w-4 h-4" />
                </button>
              )
            )}
            <button onClick={() => setShowQueue(q => !q)} className={`transition-colors ${showQueue ? "text-gold" : "text-foreground hover:text-gold"}`}>
              <ListMusic className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 w-28">
              <button onClick={() => setVolume(volume === 0 ? 0.7 : 0)}>
                <VolumeIcon className="w-4 h-4 text-foreground" />
              </button>
              <PlaybackProgress value={volume * 100} onValueChange={(value) => setVolume(value / 100)} ariaLabel="Volume" className="flex-1" />
            </div>
            <span className="text-xs text-foreground w-16 text-right">{formatTime(currentTime)} / {formatTime(duration)}</span>
            <button onClick={() => setHidden(true)} className="text-foreground hover:text-gold transition-colors ml-1">
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
                  <p className="truncate text-xs text-foreground">{song.artist}</p>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">{formatTime(song.durationSeconds || 0)}</span>
              </div>
            ))}
            {queue.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">Queue is empty</p>}
          </div>
        </div>
      )}

      {/* Premium Upgrade Modal */}
      <Dialog open={showUpgrade} onOpenChange={setShowUpgrade}>
        <DialogContent className="max-w-sm text-center">
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-16 h-16 rounded-full bg-gold/20 flex items-center justify-center">
              <Crown className="w-8 h-8 text-gold" />
            </div>
            <h3 className="text-xl font-serif font-bold text-foreground">Upgrade to Premium</h3>
            <p className="text-sm text-muted-foreground">Download songs for offline playback, access karaoke mode, and more — starting at just 2 Espees/month!</p>
            <Button className="gradient-gold text-primary-foreground w-full" onClick={() => { setShowUpgrade(false); navigate("/subscription"); }}>
              View Plans
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setShowUpgrade(false)}>
              Maybe Later
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PlayerBar;