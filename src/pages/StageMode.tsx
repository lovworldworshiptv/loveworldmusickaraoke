import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayer } from "@/contexts/PlayerContext";
import { X, Play, Pause, SkipBack, SkipForward, Minus, Plus, Music, Volume2, VolumeX, Hand, WandSparkles, Images, Video, Type, Check, Image as ImageIcon } from "lucide-react";
import { DEFAULT_STAGE_MODE, resolveStageMediaUrl, SETTING_KEYS, type StageModeSetting, useSetting } from "@/lib/siteSettings";
import {
  filterStageChoices, loadStageFonts, resolveStageFont, STAGE_BACKGROUND_STORAGE_KEY, STAGE_FONT_STORAGE_KEY, STAGE_FONTS,
  stageLibrary, type StageBackgroundTab,
} from "@/lib/stageBackgrounds";
import { Button } from "@/components/ui/button";

const BACKGROUND_TABS: { id: StageBackgroundTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "motion", label: "Motion" },
  { id: "still", label: "Still" },
  { id: "song", label: "This song" },
];

const readStored = (key: string) => {
  try { return localStorage.getItem(key); } catch { return null; }
};
const writeStored = (key: string, value: string) => {
  try { localStorage.setItem(key, value); } catch { /* private mode */ }
};

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
  const [backgroundMenuOpen, setBackgroundMenuOpen] = useState(false);
  const [selectedBackgroundId, setSelectedBackgroundId] = useState(() => readStored(STAGE_BACKGROUND_STORAGE_KEY) || "song");
  const [backgroundTab, setBackgroundTab] = useState<StageBackgroundTab>("all");
  const [fontMenuOpen, setFontMenuOpen] = useState(false);
  const [fontId, setFontId] = useState(() => resolveStageFont(readStored(STAGE_FONT_STORAGE_KEY)).id);
  const stageFont = resolveStageFont(fontId);
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
  const backgroundChoices = useMemo(() => {
    const choices = [
      { id: "song", name: "Song background", ...stage },
      ...(currentSong?.coverUrl
        ? [{ id: "artwork", name: "Song artwork", backgroundColor: stage.backgroundColor, mediaType: "image" as const, mediaUrl: currentSong.coverUrl }]
        : []),
      ...stageLibrary(setting),
    ];
    return choices.filter((choice, index) => choices.findIndex((candidate) =>
      candidate.mediaType === choice.mediaType && candidate.mediaUrl === choice.mediaUrl && candidate.backgroundColor === choice.backgroundColor
    ) === index);
  }, [currentSong?.coverUrl, setting, stage]);
  const visibleChoices = filterStageChoices(backgroundChoices, backgroundTab);
  const activeStage = backgroundChoices.find((choice) => choice.id === selectedBackgroundId)
    ?? backgroundChoices[0] ?? { id: "song", name: "Song background", ...stage };
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

  // The listener's background choice carries across songs; menus close on song change.
  useEffect(() => {
    setBackgroundMenuOpen(false);
    setFontMenuOpen(false);
  }, [currentSong?.id]);

  useEffect(() => { loadStageFonts(); }, []);

  const chooseBackground = (id: string) => {
    setSelectedBackgroundId(id);
    writeStored(STAGE_BACKGROUND_STORAGE_KEY, id);
    setBackgroundMenuOpen(false);
    pokeControls();
  };

  const chooseFont = (id: string) => {
    setFontId(id);
    writeStored(STAGE_FONT_STORAGE_KEY, id);
    setFontMenuOpen(false);
    pokeControls();
  };

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
      style={{ backgroundColor: activeStage.backgroundColor }}
      onPointerMove={pokeControls}
      onPointerDown={pokeControls}
    >
      {activeStage.mediaType === "image" && activeStage.mediaUrl && (
        <img key={activeStage.mediaUrl} src={resolveStageMediaUrl(activeStage.mediaUrl)} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover animate-in fade-in duration-700" />
      )}
      {activeStage.mediaType === "video" && activeStage.mediaUrl && (
        <video
          key={activeStage.mediaUrl}
          src={resolveStageMediaUrl(activeStage.mediaUrl)}
          poster={(activeStage as { posterUrl?: string }).posterUrl ? resolveStageMediaUrl((activeStage as { posterUrl?: string }).posterUrl as string) : undefined}
          muted
          loop
          autoPlay
          playsInline
          preload="auto"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover animate-in fade-in duration-700"
        />
      )}
      <div className="pointer-events-none absolute inset-0 bg-background/65" />
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

      <div className={`absolute top-28 right-4 z-40 flex flex-col items-end gap-2 transition-opacity duration-500 ${controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label="Choose stage background"
          aria-expanded={backgroundMenuOpen}
          onClick={() => { setBackgroundMenuOpen((open) => !open); setFontMenuOpen(false); }}
          className={`rounded-full border-gold/25 bg-background/45 backdrop-blur-xl ${backgroundMenuOpen ? "border-gold/70 text-gold" : ""}`}
        >
          <Images className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label="Choose lyrics font"
          aria-expanded={fontMenuOpen}
          onClick={() => { setFontMenuOpen((open) => !open); setBackgroundMenuOpen(false); }}
          className={`rounded-full border-gold/25 bg-background/45 backdrop-blur-xl ${fontMenuOpen ? "border-gold/70 text-gold" : ""}`}
        >
          <Type className="h-4 w-4" />
        </Button>

        {backgroundMenuOpen && (
          <div
            className="absolute right-12 top-0 w-[min(20rem,calc(100vw-5rem))] overflow-hidden rounded-2xl border border-gold/25 bg-background/80 p-2 shadow-[0_18px_50px_-12px_hsl(var(--gold)/0.35)] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200"
            role="dialog"
            aria-label="Stage backgrounds"
          >
            <div className="mb-2 grid grid-cols-4 gap-1 rounded-full bg-foreground/5 p-1" role="tablist" aria-label="Background type">
              {BACKGROUND_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={backgroundTab === tab.id}
                  onClick={() => setBackgroundTab(tab.id)}
                  className={`h-7 rounded-full text-[11px] font-semibold transition-colors ${backgroundTab === tab.id ? "bg-gold text-primary-foreground" : "text-foreground/80 hover:text-foreground"}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="grid max-h-[55dvh] grid-cols-2 gap-2 overflow-y-auto pr-0.5" role="radiogroup" aria-label="Backgrounds">
              {visibleChoices.length === 0 && (
                <p className="col-span-2 py-6 text-center text-xs text-muted-foreground">No backgrounds here yet.</p>
              )}
              {visibleChoices.map((choice) => {
                const active = activeStage.id === choice.id;
                const poster = (choice as { posterUrl?: string }).posterUrl;
                return (
                  <button
                    key={choice.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={`${choice.name}${choice.mediaType === "video" ? " (motion)" : choice.mediaType === "image" ? " (still)" : ""}`}
                    onClick={() => chooseBackground(choice.id)}
                    className={`group relative aspect-video overflow-hidden rounded-xl border text-left transition-all ${active ? "border-gold ring-2 ring-gold/50" : "border-foreground/15 hover:border-gold/50"}`}
                    style={{ backgroundColor: choice.backgroundColor }}
                  >
                    {choice.mediaType === "image" && choice.mediaUrl && (
                      <img src={resolveStageMediaUrl(choice.mediaUrl)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                    )}
                    {choice.mediaType === "video" && (poster ? (
                      <img src={resolveStageMediaUrl(poster)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                    ) : choice.mediaUrl ? (
                      <video src={`${resolveStageMediaUrl(choice.mediaUrl)}#t=0.5`} muted playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" />
                    ) : null)}
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/90 to-transparent px-1.5 pb-1 pt-4 text-[11px] font-semibold leading-tight text-foreground">
                      <span className="line-clamp-1">{choice.name}</span>
                    </span>
                    {choice.mediaType !== "none" && (
                      <span className="absolute left-1 top-1 flex items-center gap-0.5 rounded-full bg-background/70 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-foreground">
                        {choice.mediaType === "video" ? <Video className="h-2.5 w-2.5" /> : <ImageIcon className="h-2.5 w-2.5" />}
                        {choice.mediaType === "video" ? "Motion" : "Still"}
                      </span>
                    )}
                    {active && (
                      <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-gold text-primary-foreground">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {fontMenuOpen && (
          <div
            className="absolute right-12 top-12 w-[min(17rem,calc(100vw-5rem))] overflow-hidden rounded-2xl border border-gold/25 bg-background/80 p-1.5 shadow-[0_18px_50px_-12px_hsl(var(--gold)/0.35)] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200"
            role="radiogroup"
            aria-label="Lyrics fonts"
          >
            {STAGE_FONTS.map((font) => {
              const active = font.id === stageFont.id;
              return (
                <button
                  key={font.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => chooseFont(font.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${active ? "bg-gold/15 text-gold" : "text-foreground hover:bg-foreground/5"}`}
                >
                  <span className="w-8 shrink-0 text-2xl font-bold leading-none" style={{ fontFamily: font.family }}>Aa</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-semibold leading-tight" style={{ fontFamily: font.family }}>Holy, Holy, Holy</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{font.name} · {font.note}</span>
                  </span>
                  {active && <Check className="h-4 w-4 shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div
        className={`absolute top-16 left-1/2 z-30 -translate-x-1/2 flex items-center rounded-full border border-gold/20 bg-background/45 p-1 backdrop-blur-xl transition-opacity duration-500 ${
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
        className={`relative z-10 flex-1 overflow-y-auto px-6 py-[40dvh] ${manualScroll ? "touch-pan-y pointer-events-auto" : "scroll-smooth pointer-events-none"}`}
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
                style={{ fontFamily: stageFont.family }}
                className={`font-bold leading-snug transition-all duration-500 ${FONT_STEPS[fontStep]} ${manualScroll ? "cursor-pointer rounded-lg px-3 py-1" : ""} ${
                  i === (manualScroll ? selectedLineIndex : activeLrcIndex)
                    ? "text-amber-400 scale-105 drop-shadow-[0_0_25px_rgba(251,191,36,0.4)]"
                    : Math.abs(i - (manualScroll ? (selectedLineIndex ?? 0) : activeLrcIndex)) === 1
                      ? "text-foreground opacity-100"
                      : "text-foreground opacity-25"
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
                style={{ fontFamily: stageFont.family }}
                className={`font-bold leading-snug transition-all duration-500 ${FONT_STEPS[fontStep]} ${manualScroll ? "cursor-pointer rounded-lg px-3 py-1" : ""} ${manualScroll && i === selectedLineIndex ? "text-amber-400 scale-105 drop-shadow-[0_0_25px_rgba(251,191,36,0.4)]" : manualScroll && selectedLineIndex !== null && Math.abs(i - selectedLineIndex) === 1 ? "text-foreground opacity-100" : manualScroll ? "text-foreground opacity-25" : "text-foreground"}`}
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
