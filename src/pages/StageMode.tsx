import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayer } from "@/contexts/PlayerContext";
import { X, Play, Pause, SkipBack, SkipForward, Minus, Plus, Music, Volume2, VolumeX, Hand, WandSparkles } from "lucide-react";
import { DEFAULT_STAGE_MODE, SETTING_KEYS, type StageModeSetting, useSetting } from "@/lib/siteSettings";
import { Button } from "@/components/ui/button";

const FONT_STEPS = ["text-2xl", "text-3xl", "text-4xl", "text-5xl", "text-6xl"];

const StageMode = () => {
  const navigate = useNavigate();
  const {
    currentSong,
    isPlaying,
    togglePlay,
    skipNext,
    skipPrev,
    lrcLines,
    staticLyrics,
    activeLrcIndex,
    duration,
    currentTime,
    volume,
    setVolume,
  } = usePlayer();

  const [fontStep, setFontStep] = useState(2);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [audioOn, setAudioOn] = useState(volume > 0);
  const [lyricsMode, setLyricsMode] = useState<"sync" | "manual">("sync");
  const [selectedLineIndex, setSelectedLineIndex] = useState<number | null>(null);
  const previousVolume = useRef(volume > 0 ? volume : 0.7);
  const setting = useSetting<StageModeSetting>(SETTING_KEYS.stageMode);
  const globalStage = { ...DEFAULT_STAGE_MODE, ...(setting || {}) };
  const stage = currentSong
    ? { ...globalStage, ...(setting?.songOverrides?.[currentSong.id] || {}) }
    : globalStage;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([]);

  const hasSync = lrcLines.length > 0;
  const manualScroll = lyricsMode === "manual";
  const staticLines = useMemo(
    () => (hasSync ? [] : staticLyrics.split("\n").map((l) => l.trim()).filter(Boolean)),
    [hasSync, staticLyrics]
  );

  // Auto-hide controls after 3s of no interaction.
  const pokeControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControlsVisible(false), 3000);
  }, []);

  useEffect(() => {
    pokeControls();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [pokeControls]);

  // Keep the screen awake while on stage.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => {});
    return () => {
      lock?.release().catch(() => {});
    };
  }, []);

  // Keep the active lyric line centered.
  useEffect(() => {
    if (manualScroll || !hasSync || activeLrcIndex < 0) return;
    lineRefs.current[activeLrcIndex]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeLrcIndex, hasSync, manualScroll]);

  const selectManualLine = useCallback((index: number) => {
    if (!manualScroll) return;
    setSelectedLineIndex(index);
    lineRefs.current[index]?.scrollIntoView({ behavior: "smooth", block: "center" });
    pokeControls();
  }, [manualScroll, pokeControls]);

  const setNavigationMode = (mode: "sync" | "manual") => {
    setLyricsMode(mode);
    setSelectedLineIndex(mode === "manual" ? Math.max(0, activeLrcIndex) : null);
  };

  // Unsynced lyrics: slow auto-scroll across the song's duration.
  useEffect(() => {
    if (manualScroll || hasSync || !isPlaying) return;
    const el = scrollRef.current;
    if (!el || duration <= 0) return;
    const target = ((el.scrollHeight - el.clientHeight) * currentTime) / duration;
    el.scrollTo({ top: target, behavior: "smooth" });
  }, [currentTime, hasSync, isPlaying, duration, manualScroll]);

  if (!currentSong) {
    return (
      <div className="h-[100dvh] bg-black flex flex-col items-center justify-center gap-4 text-white px-6 text-center">
        <Music className="w-12 h-12 text-amber-400" />
        <p className="text-lg font-serif">Nothing is playing</p>
        <p className="text-sm text-white">Start a song, then open Stage Mode for the big-screen lyrics view.</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-600 text-foreground font-semibold text-sm"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div
      className="h-[100dvh] bg-background text-foreground flex flex-col select-none overflow-hidden relative"
      style={{ backgroundColor: stage.backgroundColor }}
      onPointerMove={pokeControls}
      onPointerDown={pokeControls}
    >
      {stage.mediaType === "image" && stage.mediaUrl && (
        <img src={stage.mediaUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      )}
      {stage.mediaType === "video" && stage.mediaUrl && (
        <video src={stage.mediaUrl} muted loop autoPlay playsInline className="absolute inset-0 h-full w-full object-cover" />
      )}
      <div className="absolute inset-0 bg-background/65" />
      {/* Top bar */}
      <div
        className={`absolute top-0 inset-x-0 z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-500 ${
          controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <button
          onClick={() => navigate(-1)}
          aria-label="Exit stage mode"
          className="w-10 h-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="text-center min-w-0 px-3">
          <p className="text-sm font-serif font-bold truncate">{currentSong.title}</p>
          <p className="text-[11px] text-white truncate">{currentSong.artist}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const next = !audioOn;
              if (!next && volume > 0) previousVolume.current = volume;
              setAudioOn(next);
              setVolume(next ? previousVolume.current : 0);
            }}
            aria-label={audioOn ? "Turn audio off" : "Turn audio on"}
            className="w-10 h-10 rounded-full bg-foreground/10 backdrop-blur flex items-center justify-center"
          >
            {audioOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setFontStep((s) => Math.max(0, s - 1))}
            aria-label="Smaller lyrics"
            className="w-10 h-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={() => setFontStep((s) => Math.min(FONT_STEPS.length - 1, s + 1))}
            aria-label="Bigger lyrics"
            className="w-10 h-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        className={`absolute top-16 left-1/2 z-20 -translate-x-1/2 flex items-center rounded-full border border-gold/20 bg-background/45 p-1 backdrop-blur-xl transition-opacity duration-500 ${
          controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        role="group"
        aria-label="Lyrics navigation mode"
      >
        <Button
          type="button"
          size="sm"
          variant={lyricsMode === "sync" ? "default" : "ghost"}
          onClick={() => setNavigationMode("sync")}
          aria-pressed={lyricsMode === "sync"}
          className="h-8 rounded-full gap-1.5 px-3"
        >
          <WandSparkles className="h-3.5 w-3.5" /> Sync
        </Button>
        <Button
          type="button"
          size="sm"
          variant={lyricsMode === "manual" ? "default" : "ghost"}
          onClick={() => setNavigationMode("manual")}
          aria-pressed={lyricsMode === "manual"}
          className="h-8 rounded-full gap-1.5 px-3"
        >
          <Hand className="h-3.5 w-3.5" /> Manual
        </Button>
      </div>

      {/* Lyrics */}
      <div
        ref={scrollRef}
        className={`relative z-10 flex-1 overflow-y-auto px-6 py-[40dvh] ${manualScroll ? "touch-pan-y" : "scroll-smooth"}`}
        style={{ scrollbarWidth: "none" }}
      >
        {hasSync ? (
          <div className="max-w-3xl mx-auto space-y-6 text-center">
            {lrcLines.map((line, i) => (
              <p
                key={i}
                ref={(el) => {
                  lineRefs.current[i] = el;
                }}
                onClick={() => selectManualLine(i)}
                className={`font-serif font-bold leading-snug transition-all duration-500 ${FONT_STEPS[fontStep]} ${manualScroll ? "cursor-pointer rounded-lg px-3 py-1" : ""} ${
                  i === (manualScroll ? selectedLineIndex : activeLrcIndex)
                    ? "text-amber-400 scale-105 drop-shadow-[0_0_25px_rgba(251,191,36,0.4)]"
                    : i < (manualScroll ? (selectedLineIndex ?? 0) : activeLrcIndex)
                      ? "text-white"
                      : "text-white"
                }`}
              >
                {line.text || "♪"}
              </p>
            ))}
          </div>
        ) : staticLines.length > 0 ? (
          <div className="max-w-3xl mx-auto space-y-6 text-center">
            {staticLines.map((line, i) => (
              <p
                key={i}
                ref={(el) => { lineRefs.current[i] = el; }}
                onClick={() => selectManualLine(i)}
                className={`font-serif font-bold leading-snug transition-all duration-500 ${FONT_STEPS[fontStep]} ${manualScroll ? "cursor-pointer rounded-lg px-3 py-1" : ""} ${manualScroll && i === selectedLineIndex ? "text-amber-400 scale-105 drop-shadow-[0_0_25px_rgba(251,191,36,0.4)]" : "text-white"}`}
              >
                {line}
              </p>
            ))}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-white">
            <Music className="w-10 h-10" />
            <p className="text-sm">No lyrics available for this song</p>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div
        className={`absolute bottom-0 inset-x-0 z-20 pb-8 pt-10 bg-gradient-to-t from-black/90 to-transparent transition-opacity duration-500 ${
          controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex items-center justify-center gap-8">
          <button onClick={skipPrev} aria-label="Previous song" className="text-white hover:text-white transition-colors">
            <SkipBack className="w-8 h-8" fill="currentColor" />
          </button>
          <button
            onClick={togglePlay}
            aria-label={isPlaying ? "Pause" : "Play"}
            className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-[0_0_30px_rgba(251,191,36,0.5)]"
          >
            {isPlaying ? (
              <Pause className="w-7 h-7 text-foreground" fill="currentColor" />
            ) : (
              <Play className="w-7 h-7 text-foreground ml-1" fill="currentColor" />
            )}
          </button>
          <button onClick={skipNext} aria-label="Next song" className="text-white hover:text-white transition-colors">
            <SkipForward className="w-8 h-8" fill="currentColor" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default StageMode;
