import { usePlayer, RepeatMode } from "@/contexts/PlayerContext";
import { ChevronDown, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, Mic2, Music, Heart, Download, Check, Lock, Disc3, Square } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useIsPremium } from "@/hooks/useIsPremium";
import { isDownloaded as checkDownloaded, saveDownload } from "@/lib/downloadManager";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown } from "lucide-react";
import KaraokeRecorder from "@/components/karaoke/KaraokeRecorder";
import AddToPlaylistModal from "@/components/playlist/AddToPlaylistModal";
import { ListPlus } from "lucide-react";

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

function useDominantColor(imageUrl?: string) {
  const [color, setColor] = useState<string | null>(null);
  useEffect(() => {
    if (!imageUrl) { setColor(null); return; }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 50; canvas.height = 50;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, 50, 50);
        const data = ctx.getImageData(0, 0, 50, 50).data;
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 16) { r += data[i]; g += data[i + 1]; b += data[i + 2]; count++; }
        r = Math.round(r / count); g = Math.round(g / count); b = Math.round(b / count);
        setColor(`${r}, ${g}, ${b}`);
      } catch { setColor(null); }
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
  } = usePlayer();
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const [showLyrics, setShowLyrics] = useState(true);
  const [showRecorder, setShowRecorder] = useState(false);
  const [isRecordingActive, setIsRecordingActive] = useState(false);
  const [recordFeatureEnabled, setRecordFeatureEnabled] = useState(true);

  useEffect(() => {
    supabase.from("app_settings" as any).select("value").eq("key", "karaoke_record_enabled").single()
      .then(({ data }: any) => {
        if (data) setRecordFeatureEnabled(data.value === true);
      });
  }, []);

  const dominantColor = useDominantColor(currentSong?.coverUrl);
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { isPremium } = useIsPremium();
  const navigate = useNavigate();
  const [isFav, setIsFav] = useState(false);
  const [dlState, setDlState] = useState<"none" | "downloading" | "done">("none");
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showAddToPlaylist, setShowAddToPlaylist] = useState(false);
  const canDl = isPremium;

  useEffect(() => {
    if (!currentSong) { setDlState("none"); return; }
    checkDownloaded(currentSong.id).then(d => setDlState(d ? "done" : "none"));
  }, [currentSong?.id]);

  const handleDl = useCallback(async () => {
    if (!currentSong?.audioUrl) return;
    if (!canDl) { setShowUpgrade(true); return; }
    setDlState("downloading");
    try {
      await saveDownload(currentSong.id, currentSong.audioUrl, {
        id: currentSong.id, title: currentSong.title, artist: currentSong.artist,
        coverUrl: currentSong.coverUrl, lyricsLrc: currentSong.lyricsLrc,
        durationSeconds: currentSong.durationSeconds || 0, album: currentSong.album,
        downloadedAt: Date.now(),
      }, currentSong.instrumentalUrl);
      setDlState("done");
      toast.success(`"${currentSong.title}" saved for offline`);
    } catch { setDlState("none"); toast.error("Download failed"); }
  }, [currentSong, canDl]);

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
    } else {
      await supabase.from("favorites").insert({ user_id: user.id, song_id: currentSong.id });
      setIsFav(true);
    }
  };

  // Reset line refs when lyrics change
  useEffect(() => {
    lineRefs.current = [];
  }, [lrcLines]);

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

  return (
    <>
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden">
      <div className="absolute inset-0 bg-background" />
      <div className="absolute inset-0" style={dominantColor ? { background: `linear-gradient(180deg, rgba(${dominantColor}, 0.35) 0%, hsl(var(--background)) 60%)` } : undefined}>
        {!dominantColor && <div className="absolute inset-0 gradient-purple opacity-30" />}
      </div>

      <div className="relative flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0 safe-top">
          <button onClick={toggleExpanded} className="text-muted-foreground hover:text-foreground transition-colors p-1">
            <ChevronDown className="w-7 h-7" />
          </button>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-medium">Now Playing</p>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <button onClick={() => setShowAddToPlaylist(true)} className="text-muted-foreground hover:text-foreground p-1">
                <ListPlus className="w-5 h-5" />
              </button>
            )}
            {currentSong?.audioUrl && (
              dlState === "done" ? (
                <span className="text-green-500 p-1"><Check className="w-5 h-5" /></span>
              ) : canDl ? (
                <button onClick={handleDl} disabled={dlState === "downloading"} className="text-muted-foreground hover:text-foreground p-1">
                  <Download className={`w-5 h-5 ${dlState === "downloading" ? "animate-pulse text-gold" : ""}`} />
                </button>
              ) : (
                <button onClick={() => setShowUpgrade(true)} className="text-gold/50 p-1">
                  <Lock className="w-5 h-5" />
                </button>
              )
            )}
            <button onClick={toggleFavorite} className={`transition-colors p-1 ${isFav ? "text-gold" : "text-muted-foreground hover:text-gold"}`}>
              <Heart className="w-5 h-5" fill={isFav ? "currentColor" : "none"} />
            </button>
          </div>
        </div>

        {/* Toggle: Album Art / Lyrics */}
        {!showLyrics ? (
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

            {/* Karaoke + Record Toggle Row */}
            <div className="flex justify-center gap-1.5 mb-3 px-6 flex-shrink-0">
              <button
                onClick={() => { if (isKaraoke) toggleKaraoke(); }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all duration-300 ${
                  !isKaraoke ? "gradient-gold text-primary-foreground shadow-lg" : "bg-secondary/60 text-muted-foreground hover:text-foreground"
                }`}>
                <Music className="w-3.5 h-3.5" /> Full Song
              </button>
              <button
                onClick={() => { if (!isKaraoke) toggleKaraoke(); }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all duration-300 ${
                  isKaraoke ? "gradient-gold text-primary-foreground shadow-lg" : "bg-secondary/60 text-muted-foreground hover:text-foreground"
                }`}>
                <Mic2 className="w-3.5 h-3.5" /> Karaoke
              </button>
              {/* Record Karaoke Button - only when enabled by admin */}
              {recordFeatureEnabled && (isPremium ? (
                <button
                  onClick={() => { if (!isKaraoke) toggleKaraoke(); setShowRecorder(true); }}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all duration-300 ${
                    isRecordingActive
                      ? "bg-destructive text-destructive-foreground shadow-[0_0_12px_hsl(var(--destructive)/0.5)] animate-pulse border border-destructive/40"
                      : "bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/30"
                  }`}
                >
                  <Disc3 className={`w-3.5 h-3.5 ${isRecordingActive ? "animate-spin" : ""}`} /> Record
                </button>
              ) : (
                <button
                  onClick={() => setShowUpgrade(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-gold/10 text-gold/70 border border-gold/20"
                >
                  <Crown className="w-3.5 h-3.5" /> Record
                </button>
              ))}
            </div>

            {/* Karaoke Recorder Panel - below toggle, not covering lyrics */}
            {showRecorder && isPremium && currentSong && (
              <div className="px-6 mb-3 flex-shrink-0">
                <KaraokeRecorder
                  songId={currentSong.id}
                  songTitle={currentSong.title}
                  instrumentalUrl={currentSong.instrumentalUrl}
                  isKaraokeMode={isKaraoke}
                  onClose={() => { setShowRecorder(false); setIsRecordingActive(false); }}
                  onRecordingStateChange={(active) => setIsRecordingActive(active)}
                />
              </div>
            )}

            {/* Synced Lyrics */}
            <div ref={lyricsContainerRef} className="flex-1 overflow-y-auto scrollbar-hide px-6 relative">
              {lrcLines.length > 0 ? (
                <div className="py-[40vh] space-y-5">
                  {lrcLines.map((line, i) => (
                    <p
                      key={i}
                      ref={(el) => { lineRefs.current[i] = el; }}
                      onClick={() => { if (duration > 0) seekTo((line.time / duration) * 100); }}
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
          <div className="mb-4 group/progress">
            <Slider value={[progress]} onValueChange={([v]) => seekTo(v)} max={100} step={0.5}
              className="w-full mb-1.5 [&_[class*=Track]]:h-1 [&_[class*=Track]]:bg-muted-foreground/20 [&_[class*=Range]]:bg-gradient-to-r [&_[class*=Range]]:from-gold [&_[class*=Range]]:via-gold-light [&_[class*=Range]]:to-gold [&_[class*=Thumb]]:w-3 [&_[class*=Thumb]]:h-3 [&_[class*=Thumb]]:bg-gold [&_[class*=Thumb]]:border-0 [&_[class*=Thumb]]:shadow-[0_0_10px_hsl(43_70%_53%/0.6)]"
            />
            <div className="flex justify-between text-[11px] text-muted-foreground font-medium">
              <span>{formatTime(currentTime)}</span>
              <span>-{formatTime(Math.max(0, duration - currentTime))}</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-8">
            <button onClick={toggleShuffle} className={`transition-all duration-200 hover:scale-110 ${shuffleOn ? "text-gold" : "text-muted-foreground hover:text-foreground"}`}>
              <Shuffle className="w-5 h-5" />
            </button>
            <button onClick={skipPrev} className="text-foreground hover:text-gold hover:scale-110 transition-all duration-200 active:scale-95">
              <SkipBack className="w-7 h-7" fill="currentColor" />
            </button>
            <button onClick={togglePlay}
              className="w-[72px] h-[72px] rounded-full bg-gradient-to-br from-gold via-gold-light to-gold flex items-center justify-center shadow-[0_6px_30px_hsl(43_70%_53%/0.6)] ring-2 ring-white/20 hover:scale-105 active:scale-95 transition-all duration-200"
            >
              {isPlaying ? <Pause className="w-8 h-8 text-white drop-shadow-sm" fill="currentColor" /> : <Play className="w-8 h-8 text-white ml-1 drop-shadow-sm" fill="currentColor" />}
            </button>
            <button onClick={skipNext} className="text-foreground hover:text-gold hover:scale-110 transition-all duration-200 active:scale-95">
              <SkipForward className="w-7 h-7" fill="currentColor" />
            </button>
            <button onClick={cycleRepeat} className={`relative transition-all duration-200 hover:scale-110 ${repeatMode !== "off" ? "text-gold" : "text-muted-foreground hover:text-foreground"}`}>
              <RepeatIcon className="w-5 h-5" />
              {repeatMode === "one" && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-gold shadow-[0_0_6px_hsl(43_70%_53%/0.8)]" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>

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
    {currentSong && (
      <AddToPlaylistModal open={showAddToPlaylist} onOpenChange={setShowAddToPlaylist} songId={currentSong.id} songTitle={currentSong.title} />
    )}
    </>
  );
};

export default ExpandedPlayer;
