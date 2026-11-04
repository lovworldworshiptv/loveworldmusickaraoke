import ArtistLinks from "@/components/artist/ArtistLinks";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Mic2, Music, Pause, Play, SkipForward, Trash2 } from "lucide-react";
import { usePlayer, type PlayerSong } from "@/contexts/PlayerContext";
import { PEEK_HEIGHT } from "@/components/player/UpNextSheet";
import { cn } from "@/lib/utils";

/** Karaoke-ready = the song has a backing track; Karaoke mode skips the rest. */
const ready = (s: PlayerSong) => !!s.instrumentalUrl;

function Cover({ song, size = 48 }: { song: PlayerSong; size?: number }) {
  return (
    <div className="rounded-lg bg-muted/50 overflow-hidden flex-shrink-0 flex items-center justify-center" style={{ width: size, height: size }}>
      {song.coverUrl ? <img src={song.coverUrl} alt="" className="w-full h-full object-cover" /> : <Music className="w-4 h-4 text-gold/50" aria-hidden="true" />}
    </div>
  );
}

function KaraokeList({ onPicked, scrollerRef, hideCurrent }: { onPicked?: () => void; scrollerRef?: RefObject<HTMLDivElement>; hideCurrent?: boolean }) {
  const { queue, queueIndex, currentSong, playQueueIndex, reorderQueue, removeFromQueue } = usePlayer();
  const upcoming = useMemo(() => queue.map((song, qi) => ({ song, qi })).filter((r) => r.qi > queueIndex), [queue, queueIndex]);
  const readyCount = upcoming.filter((r) => ready(r.song)).length;

  return (
    <div className="flex flex-col min-h-0 h-full">
      {currentSong && !hideCurrent && (
        <div className="px-4 pb-3">
          <p className="text-xs text-muted-foreground mb-2">Now singing</p>
          <div className="flex items-center gap-3 rounded-2xl bg-gold/10 border border-gold/30 p-2">
            <Cover song={currentSong} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gold truncate">{currentSong.title}</p>
              <p className="text-xs text-muted-foreground truncate"><ArtistLinks artist={currentSong.artist} /></p>
            </div>
            <Mic2 className="w-4 h-4 text-gold flex-shrink-0" aria-hidden="true" />
          </div>
        </div>
      )}
      <div className="px-4 pb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">Up Next</h3>
        <span className="text-xs text-muted-foreground">{readyCount} ready to sing</span>
      </div>
      <div ref={scrollerRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {upcoming.length === 0 ? (
          <p className="px-2 py-6 text-sm text-muted-foreground text-center">Nothing queued. When this song ends, more karaoke songs are added automatically.</p>
        ) : (
          <ul className="space-y-1">
            {upcoming.map(({ song, qi }, i) => {
              const ok = ready(song);
              return (
                <li key={`${song.id}-${qi}`} className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-muted/40">
                  <button type="button" disabled={!ok}
                    onClick={() => { playQueueIndex(qi, { autoplay: true }); onPicked?.(); }}
                    className={cn("flex items-center gap-3 min-w-0 flex-1 text-left min-h-11 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold", !ok && "opacity-50")}
                    aria-label={ok ? `Sing ${song.title} now` : `${song.title} has no backing track`}>
                    <Cover song={song} size={44} />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium truncate">{song.title}</span>
                      <span className="block text-xs text-muted-foreground truncate">{ok ? song.artist : "No backing track — skipped"}</span>
                    </span>
                  </button>
                  <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => reorderQueue(qi, upcoming[i - 1].qi)}
                    className="p-2 rounded-lg text-muted-foreground hover:text-gold disabled:opacity-30"><ArrowUp className="w-4 h-4" /></button>
                  <button type="button" aria-label="Move down" disabled={i === upcoming.length - 1} onClick={() => reorderQueue(qi, upcoming[i + 1].qi)}
                    className="p-2 rounded-lg text-muted-foreground hover:text-gold disabled:opacity-30"><ArrowDown className="w-4 h-4" /></button>
                  <button type="button" aria-label={`Remove ${song.title}`} onClick={() => removeFromQueue(qi)}
                    className="p-2 rounded-lg text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Desktop: panel beside the lyrics. */
export function KaraokeUpNextPanel() {
  return (
    <aside aria-label="Karaoke Up Next" className="w-[340px] flex-shrink-0 glass-card rounded-3xl pt-4 min-h-0 flex flex-col">
      <KaraokeList />
    </aside>
  );
}

/**
 * Mobile: the same draggable bottom sheet as Video mode's Up Next — drag the handle or
 * peek row, tap the up arrow to expand, tap the down arrow / pull down / Back / Escape to collapse.
 */
export function KaraokeUpNextSheet({ open, onOpenChange, onNext }: { open: boolean; onOpenChange: (open: boolean) => void; onNext: () => void }) {
  const { queue, queueIndex, currentSong, isPlaying, togglePlay } = usePlayer();
  const upcoming = queue.slice(queueIndex + 1);
  const next = upcoming.find(ready);
  const readyCount = upcoming.filter(ready).length;
  const countLabel = `${readyCount} ${readyCount === 1 ? "song" : "songs"} ready to sing`;

  const reducedMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const sheetRef = useRef<HTMLElement>(null);
  const peekRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const miniRowRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const safeProbeRef = useRef<HTMLDivElement>(null);
  const pRef = useRef(open ? 1 : 0);
  const travelRef = useRef(0);
  const spring = reducedMotion ? "none" : "transform 420ms cubic-bezier(0.22, 1, 0.36, 1), opacity 300ms ease";

  const apply = useCallback((p: number, animate: boolean) => {
    pRef.current = p;
    const sheet = sheetRef.current;
    if (!sheet) return;
    const transition = animate ? spring : "none";
    sheet.style.transition = transition;
    sheet.style.transform = `translate3d(0, ${(1 - p) * travelRef.current}px, 0)`;
    if (peekRef.current) {
      peekRef.current.style.transition = transition;
      peekRef.current.style.opacity = String(Math.max(0, 1 - p * 2.5));
      peekRef.current.style.pointerEvents = p > 0.5 ? "none" : "auto";
    }
    [bodyRef.current, miniRowRef.current].forEach((el) => {
      if (!el) return;
      el.style.transition = transition;
      el.style.opacity = String(Math.min(1, p * 1.6));
    });
  }, [spring]);

  const measure = useCallback(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    const safe = safeProbeRef.current?.offsetHeight ?? 0;
    travelRef.current = Math.max(0, sheet.offsetHeight - PEEK_HEIGHT - safe);
    apply(pRef.current, false);
  }, [apply]);

  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (sheetRef.current) ro.observe(sheetRef.current);
    window.addEventListener("resize", measure);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, [measure]);

  useEffect(() => {
    const target = open ? 1 : 0;
    if (pRef.current !== target) apply(target, true);
  }, [open, apply]);

  const settle = useCallback((velocity: number) => {
    const p = pRef.current;
    const nextOpen = velocity < -0.45 ? true : velocity > 0.45 ? false : p > 0.5;
    apply(nextOpen ? 1 : 0, true);
    if (nextOpen !== open) onOpenChange(nextOpen);
  }, [apply, open, onOpenChange]);

  const beginDrag = useCallback((startY: number, source: "handle" | "header") => {
    let moved = false;
    let lastY = startY;
    let lastT = performance.now();
    let velocity = 0;
    const startP = pRef.current;
    const move = (e: PointerEvent) => {
      const dy = e.clientY - startY;
      if (!moved) {
        if (Math.abs(dy) < 6) return;
        moved = true;
        const swallow = (ce: Event) => { ce.stopPropagation(); ce.preventDefault(); };
        window.addEventListener("click", swallow, { capture: true, once: true });
        window.setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 400);
      }
      const now = performance.now();
      velocity = (e.clientY - lastY) / Math.max(1, now - lastT);
      lastY = e.clientY;
      lastT = now;
      apply(Math.max(0, Math.min(1, startP - dy / (travelRef.current || 1))), false);
    };
    const up = () => {
      cleanup();
      if (moved) settle(velocity);
      else if (source === "handle") onOpenChange(!open);
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }, [apply, settle, onOpenChange, open]);

  const onDragDown = (source: "handle" | "header") => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("[data-no-sheet-drag]")) return;
    beginDrag(e.clientY, source);
  };

  // Pulling down at the top of the list closes the sheet.
  useEffect(() => {
    const sc = scrollerRef.current;
    if (!sc) return;
    let startY = 0, lastY = 0, lastT = 0, velocity = 0, pulling = false;
    const ts = (e: TouchEvent) => { startY = e.touches[0].clientY; lastY = startY; lastT = performance.now(); pulling = false; };
    const tm = (e: TouchEvent) => {
      const y = e.touches[0].clientY;
      const dy = y - startY;
      if (!pulling && sc.scrollTop <= 0 && dy > 8) pulling = true;
      if (!pulling) return;
      e.preventDefault();
      const now = performance.now();
      velocity = (y - lastY) / Math.max(1, now - lastT);
      lastY = y;
      lastT = now;
      apply(Math.max(0, Math.min(1, 1 - (dy - 8) / (travelRef.current || 1))), false);
    };
    const te = () => { if (pulling) settle(velocity); pulling = false; };
    let lastWheel = 0;
    const wheel = (e: WheelEvent) => {
      if (sc.scrollTop > 0 || e.deltaY > -25 || Date.now() - lastWheel < 500) return;
      lastWheel = Date.now();
      onOpenChange(false);
    };
    sc.addEventListener("touchstart", ts, { passive: true });
    sc.addEventListener("touchmove", tm, { passive: false });
    sc.addEventListener("touchend", te);
    sc.addEventListener("touchcancel", te);
    sc.addEventListener("wheel", wheel, { passive: true });
    return () => {
      sc.removeEventListener("touchstart", ts);
      sc.removeEventListener("touchmove", tm);
      sc.removeEventListener("touchend", te);
      sc.removeEventListener("touchcancel", te);
      sc.removeEventListener("wheel", wheel);
    };
  }, [apply, settle, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onOpenChange(false); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open, onOpenChange]);

  if (!currentSong) return null;

  return (
    <>
      <div ref={safeProbeRef} aria-hidden="true" className="fixed left-0 bottom-0 w-0 pointer-events-none invisible" style={{ height: "env(safe-area-inset-bottom, 0px)" }} />
      <section
        ref={sheetRef}
        aria-label="Karaoke Up Next"
        className="absolute inset-x-0 bottom-0 z-30 flex flex-col rounded-t-3xl bg-card/95 backdrop-blur-xl border-t border-gold/20 shadow-[0_-12px_40px_hsl(var(--background)/0.6)] overflow-hidden will-change-transform"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 60px)" }}
      >
        {/* Handle */}
        <button
          type="button"
          onPointerDown={onDragDown("handle")}
          onClick={(e) => { if (e.detail === 0) onOpenChange(!open); }}
          aria-expanded={open}
          aria-label={open ? "Close Up Next" : "Open Up Next"}
          className="w-full h-5 flex items-center justify-center flex-shrink-0"
          style={{ touchAction: "none" }}
        >
          <span className="w-10 h-1.5 rounded-full bg-muted-foreground/50" />
        </button>

        <div className="relative flex-shrink-0" onPointerDown={onDragDown("header")} style={{ touchAction: "none" }}>
          {/* Expanded: now singing + controls + collapse arrow */}
          <div ref={miniRowRef} className="relative flex items-center gap-3 px-4 pb-2 pt-1" aria-hidden={!open}>
            <Cover song={currentSong} size={56} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gold flex items-center gap-1"><Mic2 className="w-3 h-3" aria-hidden="true" /> Now singing</p>
              <p className="text-sm font-semibold text-foreground truncate">{currentSong.title}</p>
              <p className="text-xs text-muted-foreground truncate"><ArtistLinks artist={currentSong.artist} /></p>
            </div>
            <button type="button" data-no-sheet-drag tabIndex={open ? 0 : -1} onClick={togglePlay} aria-label={isPlaying ? "Pause" : "Play"}
              className="w-11 h-11 rounded-full gradient-gold flex items-center justify-center text-primary-foreground flex-shrink-0">
              {isPlaying ? <Pause className="w-5 h-5" fill="currentColor" /> : <Play className="w-5 h-5 ml-0.5" fill="currentColor" />}
            </button>
            <button type="button" data-no-sheet-drag tabIndex={open ? 0 : -1} onClick={onNext} aria-label="Next song"
              className="w-11 h-11 rounded-full flex items-center justify-center text-foreground hover:text-gold flex-shrink-0">
              <SkipForward className="w-5 h-5" fill="currentColor" />
            </button>
            <button type="button" data-no-sheet-drag tabIndex={open ? 0 : -1} onClick={() => onOpenChange(false)} aria-label="Collapse Up Next"
              className="h-11 w-11 flex items-center justify-center rounded-full text-foreground hover:text-gold hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold flex-shrink-0">
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>
          {/* Collapsed: peek row */}
          <div
            ref={peekRef}
            role="button"
            tabIndex={open ? -1 : 0}
            aria-label={next ? `Up Next: ${next.title}. ${countLabel}. Open list` : "Open Up Next"}
            onPointerDown={(e) => { e.stopPropagation(); onDragDown("handle")(e); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenChange(true); } }}
            className="absolute inset-x-0 top-0 h-16 flex items-center gap-3 px-4 bg-card"
          >
            {next ? <Cover song={next} size={48} /> : (
              <div className="w-12 h-12 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0"><Mic2 className="w-4 h-4 text-gold/50" /></div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gold">Up Next</p>
              <p className="text-sm font-medium text-foreground truncate">{next ? next.title : "Nothing up next"}</p>
              {readyCount > 0 && <p className="text-[11px] text-muted-foreground truncate">{countLabel}</p>}
            </div>
            <ChevronUp className="w-5 h-5 text-muted-foreground flex-shrink-0" aria-hidden="true" />
          </div>
        </div>

        <div ref={bodyRef} className="flex-1 min-h-0 flex flex-col" aria-hidden={!open}>
          <KaraokeList scrollerRef={scrollerRef} hideCurrent onPicked={() => onOpenChange(false)} />
        </div>
      </section>
    </>
  );
}
