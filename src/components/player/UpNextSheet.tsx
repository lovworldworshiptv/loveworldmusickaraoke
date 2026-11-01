import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronUp, Download, GripVertical, ListEnd, ListPlus, Lock, MoreHorizontal, Music, Pause, Play, Plus, RotateCcw, Save, SkipForward, Trash2, ArrowUp, ArrowDown, Video } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer, type PlayerSong } from "@/contexts/PlayerContext";
import { useAuth } from "@/contexts/AuthContext";
import { useFeatures } from "@/contexts/FeatureContext";
import { useIsPremium } from "@/hooks/useIsPremium";
import { canUseSong, isFreeSong, useFreeSongIds } from "@/lib/freeSongs";
import { getDownloadedTrack, saveDownload } from "@/lib/downloadManager";
import { readVideoProgress, useVideoStatus, watchedFraction, type VideoStatusStore } from "@/lib/videoProgress";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import AddToPlaylistModal from "@/components/playlist/AddToPlaylistModal";

// ---------------------------------------------------------------------------
// Shared hooks
// ---------------------------------------------------------------------------

/** Handle (20px) + peek row (64px): the collapsed sheet's visible height, before the safe area. */
export const PEEK_HEIGHT = 84;
const ROW_H = 76;
const DIVIDER_H = 40;
const VIRTUALIZE_AFTER = 50;
const AUTOPLAY_KEY = "lw-video-autoplay";

export function useIsDesktop() {
  const query = "(min-width: 1024px)";
  const [desktop, setDesktop] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setDesktop(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return desktop;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

export function useIsFullscreen() {
  const [full, setFull] = useState(false);
  useEffect(() => {
    const on = () => setFull(!!(document.fullscreenElement || (document as any).webkitFullscreenElement));
    document.addEventListener("fullscreenchange", on);
    document.addEventListener("webkitfullscreenchange", on);
    return () => {
      document.removeEventListener("fullscreenchange", on);
      document.removeEventListener("webkitfullscreenchange", on);
    };
  }, []);
  return full;
}

/** Autoplay on = keep going through Up Next (and more videos after it); off = stop after this video. */
export function useVideoAutoplay(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(() => {
    try { return localStorage.getItem(AUTOPLAY_KEY) !== "off"; } catch { return true; }
  });
  const set = useCallback((next: boolean) => {
    setOn(next);
    try { localStorage.setItem(AUTOPLAY_KEY, next ? "on" : "off"); } catch { /* storage unavailable */ }
  }, []);
  return [on, set];
}

type VideoInfo = { thumb: string | null; categoryId: string | null };
export type QueueVideos = {
  /** Song can play in Video mode. */
  has: (songId: string) => boolean;
  /** Whether availability for this song is already known. */
  known: (songId: string) => boolean;
  info: (songId: string) => VideoInfo | null;
  categoryName: (id: string | null) => string | null;
  status: "idle" | "loading" | "ready" | "error";
  retry: () => void;
};

const VIDEO_TYPE_ORDER = ["official", "lyric", "live", "karaoke"];

/** Which queued songs have a video (and their thumbnail / category), fetched in batches and cached. */
export function useQueueVideos(queue: PlayerSong[], active: boolean): QueueVideos {
  const cache = useRef(new Map<string, VideoInfo | null>());
  const [version, setVersion] = useState(0);
  const [status, setStatus] = useState<QueueVideos["status"]>("idle");
  const [attempt, setAttempt] = useState(0);
  const [categories, setCategories] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!active || categories.size || !navigator.onLine) return;
    supabase.from("categories").select("id, name").then(({ data }) => {
      if (data?.length) setCategories(new Map((data as { id: string; name: string }[]).map((c) => [c.id, c.name])));
    });
  }, [active, categories.size]);

  useEffect(() => {
    if (!active) return;
    const missing = [...new Set(queue.map((s) => s.id))].filter((id) => !cache.current.has(id));
    if (!missing.length) { setStatus("ready"); return; }
    let cancelled = false;
    setStatus("loading");
    (async () => {
      try {
        if (!navigator.onLine) {
          // Offline: saved downloads that include their video.
          const found = await Promise.all(missing.slice(0, 60).map((id) => getDownloadedTrack(id).catch(() => null)));
          missing.slice(0, 60).forEach((id, i) => {
            const v = found[i]?.video;
            cache.current.set(id, v ? { thumb: v.thumbnail_url, categoryId: null } : null);
          });
        } else {
          for (let i = 0; i < missing.length; i += 150) {
            const chunk = missing.slice(i, i + 150);
            const [videos, songs] = await Promise.all([
              supabase.from("song_videos").select("song_id, thumbnail_url, video_type").in("song_id", chunk).eq("is_active", true),
              supabase.from("songs").select("id, category_id").in("id", chunk),
            ]);
            if (videos.error) throw videos.error;
            const cat = new Map(((songs.data || []) as { id: string; category_id: string | null }[]).map((s) => [s.id, s.category_id]));
            const best = new Map<string, { thumbnail_url: string | null; video_type: string }>();
            ((videos.data || []) as { song_id: string; thumbnail_url: string | null; video_type: string }[]).forEach((v) => {
              const prev = best.get(v.song_id);
              if (!prev || VIDEO_TYPE_ORDER.indexOf(v.video_type) < VIDEO_TYPE_ORDER.indexOf(prev.video_type) || (!prev.thumbnail_url && v.thumbnail_url)) best.set(v.song_id, v);
            });
            chunk.forEach((id) => {
              const v = best.get(id);
              cache.current.set(id, v ? { thumb: v.thumbnail_url, categoryId: cat.get(id) ?? null } : null);
            });
          }
        }
        if (!cancelled) { setVersion((v) => v + 1); setStatus("ready"); }
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => { cancelled = true; };
  }, [queue, active, attempt]);

  return useMemo<QueueVideos>(() => ({
    has: (id) => !!cache.current.get(id),
    known: (id) => cache.current.has(id),
    info: (id) => cache.current.get(id) ?? null,
    categoryName: (id) => (id ? categories.get(id) ?? null : null),
    status,
    retry: () => setAttempt((a) => a + 1),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [version, status, categories]);
}

const fmtDur = (s?: number) => {
  if (!s || !isFinite(s)) return "";
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
};
const fmtTotal = (s: number) => {
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} hr ${m % 60} min`;
};

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

function Thumb({ src, fallback, className = "", children }: { src?: string | null; fallback?: string; className?: string; children?: ReactNode }) {
  const candidates = useMemo(() => [src, fallback].filter(Boolean) as string[], [src, fallback]);
  const [stage, setStage] = useState(0);
  useEffect(() => setStage(0), [candidates]);
  const url = candidates[stage];
  return (
    <div className={`relative aspect-video overflow-hidden rounded-lg bg-gradient-to-br from-secondary via-muted to-gold/30 flex-shrink-0 ${className}`}>
      {url ? (
        <img src={url} alt="" loading="lazy" decoding="async" onError={() => setStage((n) => n + 1)} className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <Video className="absolute inset-0 m-auto w-5 h-5 text-gold/50" aria-hidden="true" />
      )}
      {children}
    </div>
  );
}

function Equalizer({ playing }: { playing: boolean }) {
  return (
    <span className="absolute inset-0 flex items-end justify-center gap-[3px] pb-2 bg-background/40" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span key={i} className="lw-eq-bar w-[3px] h-4 rounded-full bg-gold" style={{ animationDelay: `${i * 0.18}s`, animationPlayState: playing ? "running" : "paused" }} />
      ))}
    </span>
  );
}

/** Thin progress line + play/pause for the pinned mini video. */
function MiniControls({ status, onNext, title, artist }: { status: VideoStatusStore; onNext: () => void; title: string; artist: string }) {
  const { time, dur, playing } = useVideoStatus(status);
  return (
    <>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{artist}</p>
      </div>
      <button type="button" onClick={() => status.controls.toggle()} aria-label={playing ? "Pause video" : "Play video"}
        className="w-11 h-11 rounded-full flex items-center justify-center text-foreground hover:text-gold flex-shrink-0">
        {playing ? <Pause className="w-6 h-6" fill="currentColor" /> : <Play className="w-6 h-6" fill="currentColor" />}
      </button>
      <button type="button" onClick={onNext} aria-label="Next video" className="w-11 h-11 rounded-full flex items-center justify-center text-foreground hover:text-gold flex-shrink-0">
        <SkipForward className="w-5 h-5" fill="currentColor" />
      </button>
      <span className="absolute left-0 right-0 bottom-0 h-[3px] bg-muted/60 overflow-hidden rounded-full" aria-hidden="true">
        <span className="block h-full bg-gold origin-left" style={{ transform: `scaleX(${dur ? Math.min(1, time / dur) : 0})` }} />
      </span>
    </>
  );
}

/** Last 8 seconds: "Up next in N" card over the video's corner. */
export function UpNextCountdown({ status, show, song, thumb, onPlayNow, onCancel }: {
  status: VideoStatusStore; show: boolean; song?: PlayerSong; thumb?: string | null; onPlayNow: () => void; onCancel: () => void;
}) {
  const { time, dur } = useVideoStatus(status);
  const remaining = dur - time;
  if (!show || !song || !dur || dur < 15 || remaining > 8 || remaining <= 0) return null;
  const R = 15;
  const C = 2 * Math.PI * R;
  return (
    <div role="status" aria-live="polite"
      className="absolute top-2 right-2 z-30 w-[min(68%,260px)] rounded-xl bg-card/95 backdrop-blur-md border border-gold/30 shadow-[0_8px_30px_hsl(var(--gold)/0.25)] p-2 animate-fade-in">
      <div className="flex items-center gap-2">
        <div className="relative w-9 h-9 flex-shrink-0">
          <svg viewBox="0 0 36 36" className="w-9 h-9 -rotate-90" aria-hidden="true">
            <circle cx="18" cy="18" r={R} className="stroke-muted" strokeWidth="3" fill="none" />
            <circle cx="18" cy="18" r={R} className="stroke-gold" strokeWidth="3" fill="none" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - Math.max(0, Math.min(1, remaining / 8)))} />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-foreground">{Math.ceil(remaining)}</span>
        </div>
        <Thumb src={thumb} fallback={song.coverUrl} className="w-14 hidden min-[400px]:block" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wider text-gold font-semibold">Up next</p>
          <p className="text-xs font-semibold text-foreground truncate">{song.title}</p>
        </div>
      </div>
      <div className="mt-1.5 flex gap-1.5">
        <button type="button" onClick={onPlayNow} className="flex-1 h-8 rounded-full gradient-gold text-primary-foreground text-xs font-semibold">Play now</button>
        <button type="button" onClick={onCancel} className="flex-1 h-8 rounded-full bg-secondary text-foreground text-xs font-semibold hover:bg-secondary/80">Cancel</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

type RowItem = { kind: "row"; qi: number; song: PlayerSong; auto: boolean } | { kind: "divider" };

interface RowProps {
  qi: number;
  song: PlayerSong;
  thumb: string | null;
  watched: number | null;
  draggable: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  canDownload: boolean;
  showDownload: boolean;
  showAddToPlaylist: boolean;
  dragging: boolean;
  dragOffset: number;
  swipeEnabled: boolean;
  onPlay: () => void;
  onPlayNext: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onMoveToEnd: () => void;
  onAddToPlaylist: () => void;
  onDownload: () => void;
  onRemove: () => void;
  onDragStart: (e: React.PointerEvent) => void;
}

function QueueRow(p: RowProps) {
  const [swipeX, setSwipeX] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const gesture = useRef<{ x: number; y: number; t: number; horizontal: boolean | null; longPress: number | null; consumed: boolean } | null>(null);
  const suppressClick = useRef(false);

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-row-control]")) return;
    const longPress = window.setTimeout(() => {
      if (!gesture.current) return;
      gesture.current.consumed = true;
      suppressClick.current = true;
      navigator.vibrate?.(10);
      p.setMenuOpen(true);
    }, 500);
    gesture.current = { x: e.clientX, y: e.clientY, t: performance.now(), horizontal: null, longPress, consumed: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g || g.consumed) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (g.horizontal === null && Math.hypot(dx, dy) > 8) {
      if (g.longPress) { clearTimeout(g.longPress); g.longPress = null; }
      g.horizontal = p.swipeEnabled && e.pointerType !== "mouse" && Math.abs(dx) > Math.abs(dy) * 1.3 && dx < 0;
      if (!g.horizontal) { gesture.current = null; return; }
      suppressClick.current = true;
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    }
    if (g.horizontal) setSwipeX(Math.min(0, dx));
  };
  const end = (e: React.PointerEvent) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    if (g.longPress) clearTimeout(g.longPress);
    if (!g.horizontal) return;
    const width = (e.currentTarget as HTMLElement).offsetWidth || 300;
    const velocity = (e.clientX - g.x) / Math.max(1, performance.now() - g.t);
    if (swipeX < -width * 0.35 || velocity < -0.6) {
      setLeaving(true);
      setSwipeX(-width);
      window.setTimeout(p.onRemove, 180);
    } else setSwipeX(0);
  };

  return (
    <div className="relative h-full px-2" role="listitem">
      {/* Revealed behind a left swipe */}
      <div className="absolute inset-y-1 right-2 left-2 rounded-xl bg-destructive/90 flex items-center justify-end pr-5 text-destructive-foreground" aria-hidden="true"
        style={{ opacity: swipeX < -4 ? 1 : 0 }}>
        <Trash2 className="w-5 h-5" />
      </div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={end}
        onPointerCancel={end}
        onClickCapture={(e) => { if (suppressClick.current) { e.stopPropagation(); e.preventDefault(); suppressClick.current = false; } }}
        className={`relative h-full flex items-center gap-2 rounded-xl px-1.5 ${p.dragging ? "z-20 bg-card shadow-[0_12px_32px_hsl(var(--gold)/0.35)] ring-1 ring-gold/50" : swipeX !== 0 ? "bg-card" : "hover:bg-muted/40"}`}
        style={{
          transform: p.dragging ? `translate3d(0, ${p.dragOffset}px, 0) scale(1.03)` : `translate3d(${swipeX}px, 0, 0)`,
          transition: p.dragging || (gesture.current?.horizontal) ? "none" : "transform 200ms ease-out",
          opacity: leaving ? 0 : 1,
          touchAction: "pan-y",
        }}
      >
        <button type="button" onClick={p.onPlay} className="flex items-center gap-3 flex-1 min-w-0 h-full text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          aria-label={`Play ${p.song.title}`}>
          <Thumb src={p.thumb} fallback={p.song.coverUrl} className="w-[104px]">
            {!!p.song.durationSeconds && (
              <span className="absolute bottom-1 right-1 rounded px-1 py-px text-[10px] font-semibold bg-background/80 text-foreground">{fmtDur(p.song.durationSeconds)}</span>
            )}
            {p.watched !== null && (
              <span className="absolute left-0 right-0 bottom-0 h-[3px] bg-background/50" aria-hidden="true">
                <span className="block h-full bg-gold origin-left" style={{ transform: `scaleX(${p.watched})` }} />
              </span>
            )}
          </Thumb>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-foreground line-clamp-2 leading-snug">{p.song.title}</span>
            <span className="block text-xs text-muted-foreground truncate">{p.song.album ? `${p.song.artist} · ${p.song.album}` : p.song.artist}</span>
          </span>
        </button>
        <DropdownMenu open={p.menuOpen} onOpenChange={p.setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button type="button" data-row-control aria-label={`More options for ${p.song.title}`}
              className="w-11 h-11 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground flex-shrink-0">
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onSelect={p.onPlayNext}><Play className="w-4 h-4 mr-2" /> Play next</DropdownMenuItem>
            {p.draggable && p.canMoveUp && <DropdownMenuItem onSelect={p.onMoveUp}><ArrowUp className="w-4 h-4 mr-2" /> Move up</DropdownMenuItem>}
            {p.draggable && p.canMoveDown && <DropdownMenuItem onSelect={p.onMoveDown}><ArrowDown className="w-4 h-4 mr-2" /> Move down</DropdownMenuItem>}
            <DropdownMenuItem onSelect={p.onMoveToEnd}><ListEnd className="w-4 h-4 mr-2" /> Move to end</DropdownMenuItem>
            {p.showAddToPlaylist && <DropdownMenuItem onSelect={p.onAddToPlaylist}><ListPlus className="w-4 h-4 mr-2" /> Add to playlist</DropdownMenuItem>}
            {p.showDownload && (
              <DropdownMenuItem onSelect={p.onDownload}>
                {p.canDownload ? <Download className="w-4 h-4 mr-2" /> : <Lock className="w-4 h-4 mr-2 text-gold" />} Download
                {!p.canDownload && <span className="ml-auto text-[10px] font-semibold text-gold">Premium</span>}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={p.onRemove} className="text-destructive focus:text-destructive"><Trash2 className="w-4 h-4 mr-2" /> Remove from queue</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {p.draggable && (
          <button type="button" data-row-control onPointerDown={p.onDragStart} aria-label={`Drag to reorder ${p.song.title}`}
            className="w-9 h-11 flex items-center justify-center text-muted-foreground hover:text-gold cursor-grab active:cursor-grabbing flex-shrink-0"
            style={{ touchAction: "none" }}>
            <GripVertical className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The sheet / panel
// ---------------------------------------------------------------------------

export interface UpNextSheetProps {
  variant: "sheet" | "panel";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  upNext: number[];
  videos: QueueVideos;
  status: VideoStatusStore;
  autoplay: boolean;
  setAutoplay: (on: boolean) => void;
  onPlayIndex: (index: number) => void;
  onNext: () => void;
  onUpgrade: () => void;
  /** Mobile only: the video frame moved into the sheet, its fixed slot, and the swipe area. */
  frameEl?: HTMLDivElement | null;
  slotEl?: HTMLDivElement | null;
  regionEl?: HTMLDivElement | null;
}

const UpNextSheet = (props: UpNextSheetProps) => {
  const { variant, open, onOpenChange, upNext, videos, status, autoplay, setAutoplay, onPlayIndex, onNext, onUpgrade, frameEl, slotEl, regionEl } = props;
  const isSheet = variant === "sheet";
  const navigate = useNavigate();
  const { user } = useAuth();
  const { enabled } = useFeatures();
  const { isPremium } = useIsPremium();
  const freeIds = useFreeSongIds();
  const { currentSong, queue, queueIndex, repeatMode, isKaraoke, extendQueue, autoAddedIds, reorderQueue, removeFromQueue, playNextInQueue, insertIntoQueue, toggleExpanded } = usePlayer();
  const playing = useSyncExternalStore(status.subscribe, () => status.get().playing, () => status.get().playing);
  const reducedMotion = usePrefersReducedMotion();

  // --- Filter chips (view only; never changes the queue order) ---
  const [filter, setFilter] = useState<string | null>(null);
  const chips = useMemo(() => {
    const seen = new Map<string, string>();
    upNext.forEach((qi) => {
      const id = videos.info(queue[qi]?.id)?.categoryId ?? null;
      const name = videos.categoryName(id);
      if (id && name && !seen.has(id)) seen.set(id, name);
    });
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [upNext, queue, videos]);
  useEffect(() => { if (filter && !chips.some((c) => c.id === filter)) setFilter(null); }, [chips, filter]);
  const shownRows = useMemo(() => (filter ? upNext.filter((qi) => videos.info(queue[qi]?.id)?.categoryId === filter) : upNext), [filter, upNext, queue, videos]);
  const canDrag = !filter;

  const items = useMemo<RowItem[]>(() => {
    const out: RowItem[] = [];
    let dividerShown = false;
    shownRows.forEach((qi) => {
      const song = queue[qi];
      const auto = autoAddedIds.has(song.id);
      if (auto && !dividerShown) { out.push({ kind: "divider" }); dividerShown = true; }
      out.push({ kind: "row", qi, song, auto });
    });
    return out;
  }, [shownRows, queue, autoAddedIds]);
  const tops = useMemo(() => {
    const t: number[] = [];
    let y = 0;
    items.forEach((it) => { t.push(y); y += it.kind === "row" ? ROW_H : DIVIDER_H; });
    t.push(y);
    return t;
  }, [items]);
  const totalH = tops[tops.length - 1] || 0;
  const rowCount = shownRows.length;

  const totalSeconds = useMemo(() => upNext.reduce((sum, qi) => sum + (queue[qi]?.durationSeconds || 0), 0), [upNext, queue]);
  const nextSong = upNext.length ? queue[upNext[0]] : undefined;
  const nextThumb = nextSong ? videos.info(nextSong.id)?.thumb : null;
  const currentThumb = currentSong ? videos.info(currentSong.id)?.thumb : null;
  const [progressMap, setProgressMap] = useState(() => readVideoProgress());
  useEffect(() => { setProgressMap(readVideoProgress()); }, [currentSong?.id, open]);

  // --- Infinite scroll: more videos when the list runs low (Autoplay on) ---
  const [extending, setExtending] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  useEffect(() => { setExhausted(false); }, [queue.length]);
  const loadMore = useCallback(async () => {
    if (extending || exhausted || !autoplay) return;
    setExtending(true);
    const added = await extendQueue("video");
    setExtending(false);
    if (added < 0) setExhausted(true);
  }, [extending, exhausted, autoplay, extendQueue]);
  const listVisible = !isSheet || open;
  useEffect(() => {
    if (listVisible && autoplay && videos.status === "ready" && upNext.length < 8 && queue.length > 0) loadMore();
  }, [listVisible, autoplay, videos.status, upNext.length, queue.length, loadMore]);

  // --- Virtualized list scrolling ---
  const scrollerRef = useRef<HTMLDivElement>(null);
  const rowsRef = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState({ top: 0, height: 800, offset: 0 });
  const measureScroll = useCallback(() => {
    const sc = scrollerRef.current;
    if (!sc) return;
    setScroll({ top: sc.scrollTop, height: sc.clientHeight, offset: rowsRef.current?.offsetTop ?? 0 });
    if (listVisible && sc.scrollHeight - sc.scrollTop - sc.clientHeight < ROW_H * 3) loadMore();
  }, [loadMore, listVisible]);
  useEffect(() => { measureScroll(); }, [measureScroll, items.length, open]);

  // --- Drag to reorder (handle) ---
  const [drag, setDrag] = useState<{ index: number; offset: number; target: number } | null>(null);
  const dragRef = useRef<{ index: number; startY: number; startScroll: number; y: number; raf: number | null } | null>(null);
  const rowIndexAt = useCallback((y: number) => {
    // y relative to rows container → nearest row item index
    let best = -1;
    let bestDist = Infinity;
    items.forEach((it, i) => {
      if (it.kind !== "row") return;
      const d = Math.abs(tops[i] + ROW_H / 2 - y);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    return best;
  }, [items, tops]);
  const startDrag = (index: number) => (e: React.PointerEvent) => {
    if (!canDrag || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const sc = scrollerRef.current;
    if (!sc) return;
    navigator.vibrate?.(8);
    dragRef.current = { index, startY: e.clientY, startScroll: sc.scrollTop, y: e.clientY, raf: null };
    setDrag({ index, offset: 0, target: index });
    const update = () => {
      const d = dragRef.current;
      const s = scrollerRef.current;
      const rows = rowsRef.current;
      if (!d || !s || !rows) return;
      // Auto-scroll near the edges.
      const rect = s.getBoundingClientRect();
      if (d.y < rect.top + 56) s.scrollTop -= 10;
      else if (d.y > rect.bottom - 56) s.scrollTop += 10;
      const offset = d.y - d.startY + (s.scrollTop - d.startScroll);
      const relY = d.y - rows.getBoundingClientRect().top;
      const target = rowIndexAt(relY);
      setDrag({ index: d.index, offset, target: target < 0 ? d.index : target });
      d.raf = requestAnimationFrame(update);
    };
    dragRef.current.raf = requestAnimationFrame(update);
    const move = (ev: PointerEvent) => { if (dragRef.current) dragRef.current.y = ev.clientY; };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      const d = dragRef.current;
      dragRef.current = null;
      if (d?.raf) cancelAnimationFrame(d.raf);
      setDrag((cur) => {
        if (cur && cur.target !== cur.index) {
          const from = items[cur.index];
          const to = items[cur.target];
          if (from?.kind === "row" && to?.kind === "row") reorderQueue(from.qi, to.qi);
        }
        return null;
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  // --- Row actions ---
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [playlistSong, setPlaylistSong] = useState<PlayerSong | null>(null);
  const removeWithUndo = useCallback((qi: number) => {
    const song = queue[qi];
    if (!song) return;
    removeFromQueue(qi);
    toast(`Removed “${song.title}”`, { action: { label: "Undo", onClick: () => insertIntoQueue(song, qi) }, duration: 5000 });
  }, [queue, removeFromQueue, insertIntoQueue]);
  const download = useCallback(async (song: PlayerSong) => {
    if (!song.audioUrl) return;
    if (!canUseSong(isPremium, song, freeIds)) { onUpgrade(); return; }
    try {
      await saveDownload(song.id, song.audioUrl, {
        id: song.id, title: song.title, artist: song.artist, coverUrl: song.coverUrl, lyricsLrc: song.lyricsLrc,
        durationSeconds: song.durationSeconds || 0, album: song.album, isFreeDownload: isFreeSong(song, freeIds), downloadedAt: Date.now(),
      }, song.instrumentalUrl);
      toast.success(`Saved “${song.title}” for offline listening`);
    } catch (e) {
      const msg = (e as Error)?.message || "";
      if (msg !== "Download cancelled") toast.error(msg.startsWith("Sign in") ? msg : "Couldn't save this song — try again");
    }
  }, [isPremium, freeIds, onUpgrade]);

  // --- Save the queue as a playlist (signed-in listeners) ---
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const canSave = !!user && enabled("playlists");
  const saveQueue = async () => {
    if (!user || !saveName.trim()) return;
    const ids = [...new Set([currentSong?.id, ...upNext.map((qi) => queue[qi]?.id)].filter(Boolean) as string[])];
    if (!ids.length) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.from("playlists").insert({ name: saveName.trim(), user_id: user.id }).select("id").single();
      if (error) throw error;
      const { error: songsError } = await supabase.from("playlist_songs").insert(ids.map((song_id, i) => ({ playlist_id: data.id, song_id, sort_order: i })));
      if (songsError) throw songsError;
      toast.success(`Saved ${ids.length} videos to “${saveName.trim()}”`);
      setSaveOpen(false);
    } catch {
      toast.error("Couldn't save the playlist — try again");
    } finally {
      setSaving(false);
    }
  };

  const browseVideos = () => {
    // Replace the Up Next history entry (if any) so Back from Videos doesn't reopen the list.
    navigate("/videos", { replace: !!(window.history.state as { lwUpNext?: boolean } | null)?.lwUpNext });
    toggleExpanded();
  };

  // -------------------------------------------------------------------------
  // Sheet position (mobile): p = 0 collapsed … 1 expanded, transforms only
  // -------------------------------------------------------------------------
  const sheetRef = useRef<HTMLDivElement>(null);
  const peekRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const miniSlotRef = useRef<HTMLDivElement>(null);
  const miniRowRef = useRef<HTMLDivElement>(null);
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
    // Move the very same video element into the pinned mini slot.
    if (frameEl && slotEl && miniSlotRef.current && sheet.offsetParent) {
      const parentRect = (sheet.offsetParent as HTMLElement).getBoundingClientRect();
      const s = slotEl.getBoundingClientRect();
      let tx = 0;
      let ty = 0;
      let el: HTMLElement | null = miniSlotRef.current;
      while (el && el !== sheet) { tx += el.offsetLeft; ty += el.offsetTop; el = el.offsetParent as HTMLElement | null; }
      const targetLeft = parentRect.left + sheet.offsetLeft + tx;
      const targetTop = parentRect.top + sheet.offsetTop + ty;
      const k = s.width ? miniSlotRef.current.offsetWidth / s.width : 1;
      frameEl.style.transformOrigin = "0 0";
      frameEl.style.transition = transition;
      if (p <= 0) {
        frameEl.style.transform = "";
        frameEl.style.zIndex = "";
        frameEl.style.pointerEvents = "";
      } else {
        frameEl.style.transform = `translate3d(${(targetLeft - s.left) * p}px, ${(targetTop - s.top) * p}px, 0) scale(${1 + (k - 1) * p})`;
        frameEl.style.zIndex = "40";
        frameEl.style.pointerEvents = p > 0.5 ? "none" : "";
      }
    }
  }, [frameEl, slotEl, spring]);

  const measure = useCallback(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    const safe = safeProbeRef.current?.offsetHeight ?? 0;
    travelRef.current = Math.max(0, sheet.offsetHeight - PEEK_HEIGHT - safe);
    apply(pRef.current, false);
  }, [apply]);

  useLayoutEffect(() => {
    if (!isSheet) return;
    measure();
    const ro = new ResizeObserver(measure);
    if (sheetRef.current) ro.observe(sheetRef.current);
    if (slotEl) ro.observe(slotEl);
    window.addEventListener("resize", measure);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, [isSheet, measure, slotEl]);

  // Open / close from outside (tap, Back button, Escape) snaps with the spring.
  useEffect(() => {
    if (!isSheet) return;
    const target = open ? 1 : 0;
    if (pRef.current !== target) apply(target, true);
  }, [open, isSheet, apply]);

  // Leaving Video mode or fullscreen: give the frame back its normal place.
  useEffect(() => () => {
    if (frameEl) { frameEl.style.transform = ""; frameEl.style.zIndex = ""; frameEl.style.pointerEvents = ""; frameEl.style.transition = ""; }
  }, [frameEl]);

  const settle = useCallback((velocity: number) => {
    const p = pRef.current;
    const next = velocity < -0.45 ? true : velocity > 0.45 ? false : p > 0.5;
    apply(next ? 1 : 0, true);
    if (next !== open) onOpenChange(next);
  }, [apply, open, onOpenChange]);

  // Drag that follows the finger. Sources: handle / peek (tap toggles), expanded header, area under the video.
  const beginDrag = useCallback((startX: number, startY: number, source: "handle" | "header" | "region") => {
    let moved = false;
    let lastY = startY;
    let lastT = performance.now();
    let velocity = 0;
    const startP = pRef.current;
    const move = (e: PointerEvent) => {
      const dy = e.clientY - startY;
      const dx = e.clientX - startX;
      if (!moved) {
        if (Math.abs(dy) < 6) return;
        // The area under the video only opens the list (upward, mostly vertical swipes).
        if (source === "region" && (dy > 0 || Math.abs(dx) > Math.abs(dy))) { cleanup(); return; }
        moved = true;
        const swallow = (ce: Event) => { ce.stopPropagation(); ce.preventDefault(); };
        window.addEventListener("click", swallow, { capture: true, once: true });
        window.setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 400);
      }
      const now = performance.now();
      velocity = (e.clientY - lastY) / Math.max(1, now - lastT);
      lastY = e.clientY;
      lastT = now;
      const travel = travelRef.current || 1;
      apply(Math.max(0, Math.min(1, startP - dy / travel)), false);
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
    if (!isSheet || e.button !== 0) return;
    beginDrag(e.clientX, e.clientY, source);
  };

  // Swipe up / scroll up on the player page opens the list.
  useEffect(() => {
    if (!isSheet || !regionEl) return;
    const down = (e: PointerEvent) => {
      if (e.button !== 0 || pRef.current > 0) return;
      const t = e.target as HTMLElement;
      if (t.closest("[data-no-sheet-drag], [role='slider'], input")) return;
      beginDrag(e.clientX, e.clientY, "region");
    };
    let lastWheel = 0;
    const wheel = (e: WheelEvent) => {
      if (pRef.current > 0 || e.deltaY < 25 || Date.now() - lastWheel < 500) return;
      lastWheel = Date.now();
      onOpenChange(true);
    };
    regionEl.addEventListener("pointerdown", down);
    regionEl.addEventListener("wheel", wheel, { passive: true });
    return () => { regionEl.removeEventListener("pointerdown", down); regionEl.removeEventListener("wheel", wheel); };
  }, [isSheet, regionEl, beginDrag, onOpenChange]);

  // Pulling down at the top of the list closes the sheet.
  useEffect(() => {
    const sc = scrollerRef.current;
    if (!isSheet || !sc) return;
    let startY = 0;
    let pulling = false;
    let lastY = 0;
    let lastT = 0;
    let velocity = 0;
    const ts = (e: TouchEvent) => { startY = e.touches[0].clientY; lastY = startY; lastT = performance.now(); pulling = false; };
    const tm = (e: TouchEvent) => {
      if (dragRef.current) return;
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
  }, [isSheet, apply, settle, onOpenChange]);

  useEffect(() => {
    if (!isSheet || !open) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onOpenChange(false); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [isSheet, open, onOpenChange]);

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------
  const visibleRange = (() => {
    if (items.length <= VIRTUALIZE_AFTER) return [0, items.length] as const;
    const from = scroll.top - scroll.offset - ROW_H * 4;
    const to = scroll.top - scroll.offset + scroll.height + ROW_H * 4;
    let start = 0;
    while (start < items.length && tops[start + 1] < from) start++;
    let end = start;
    while (end < items.length && tops[end] < to) end++;
    return [start, end] as const;
  })();

  const rowNodes: ReactNode[] = [];
  const renderIndex = (i: number) => {
    const it = items[i];
    if (!it) return;
    if (it.kind === "divider") {
      rowNodes.push(
        <div key="divider" className="absolute left-0 right-0 px-4 flex items-center gap-3" style={{ top: tops[i], height: DIVIDER_H }}>
          <span className="h-px flex-1 bg-gold/30" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-gold">More videos for you</span>
          <span className="h-px flex-1 bg-gold/30" />
        </div>,
      );
      return;
    }
    const prevRow = items.slice(0, i).reverse().find((x) => x.kind === "row") as Extract<RowItem, { kind: "row" }> | undefined;
    const nextRow = items.slice(i + 1).find((x) => x.kind === "row") as Extract<RowItem, { kind: "row" }> | undefined;
    rowNodes.push(
      <div key={`${it.song.id}-${it.qi}`} className="absolute left-0 right-0" style={{ top: tops[i], height: ROW_H }}>
        <QueueRow
          qi={it.qi}
          song={it.song}
          thumb={videos.info(it.song.id)?.thumb ?? null}
          watched={watchedFraction(progressMap, it.song.id)}
          draggable={canDrag}
          canMoveUp={!!prevRow}
          canMoveDown={!!nextRow}
          menuOpen={menuFor === it.qi}
          setMenuOpen={(o) => setMenuFor(o ? it.qi : null)}
          canDownload={canUseSong(isPremium, it.song, freeIds)}
          showDownload={!!it.song.audioUrl}
          showAddToPlaylist={!!user && enabled("playlists")}
          dragging={drag?.index === i}
          dragOffset={drag?.index === i ? drag.offset : 0}
          swipeEnabled={isSheet}
          onPlay={() => onPlayIndex(it.qi)}
          onPlayNext={() => playNextInQueue(it.qi)}
          onMoveUp={() => prevRow && reorderQueue(it.qi, prevRow.qi)}
          onMoveDown={() => nextRow && reorderQueue(it.qi, nextRow.qi)}
          onMoveToEnd={() => reorderQueue(it.qi, queue.length - 1)}
          onAddToPlaylist={() => setPlaylistSong(it.song)}
          onDownload={() => download(it.song)}
          onRemove={() => removeWithUndo(it.qi)}
          onDragStart={startDrag(i)}
        />
      </div>,
    );
  };
  for (let i = visibleRange[0]; i < visibleRange[1]; i++) renderIndex(i);
  if (drag && (drag.index < visibleRange[0] || drag.index >= visibleRange[1])) renderIndex(drag.index);

  const loadingFirst = videos.status === "loading" && upNext.length === 0;
  const countLabel = `${upNext.length} ${upNext.length === 1 ? "video" : "videos"}${totalSeconds ? ` · ${fmtTotal(totalSeconds)}` : ""}`;

  const header = (
    <div className="flex items-center gap-2 px-4 pt-1 pb-2">
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-serif font-bold text-foreground">Up Next</h3>
        <p className="text-[11px] text-muted-foreground">{upNext.length ? countLabel : "Queue"}</p>
      </div>
      {canSave && (
        <Button type="button" variant="ghost" size="sm" className="h-11 gap-1.5 text-foreground hover:text-gold" onClick={() => { setSaveName(currentSong ? `Up Next · ${currentSong.title}` : "Up Next"); setSaveOpen(true); }}
          disabled={!upNext.length && !currentSong}>
          <Save className="w-4 h-4" /> Save
        </Button>
      )}
      <label className="flex items-center gap-2 h-11 pl-1 text-xs font-semibold text-foreground cursor-pointer">
        Autoplay
        <Switch checked={autoplay} onCheckedChange={setAutoplay} aria-label="Autoplay next videos" />
      </label>
    </div>
  );

  const list = (
    <>
      {chips.length > 1 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 pb-2 flex-shrink-0" role="toolbar" aria-label="Filter Up Next">
          {[{ id: null as string | null, name: "All" }, ...chips].map((c) => (
            <button key={c.id ?? "all"} type="button" onClick={() => setFilter(c.id)} aria-pressed={filter === c.id}
              className={`h-9 px-4 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${filter === c.id ? "gradient-gold text-primary-foreground" : "bg-secondary/70 text-foreground hover:text-gold"}`}>
              {c.name}
            </button>
          ))}
        </div>
      )}
      <div ref={scrollerRef} onScroll={measureScroll} className="relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))]">
        {currentSong && (
          <div className="px-4 pt-1 pb-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Now Playing</p>
            <div className="flex items-center gap-3 rounded-xl p-1.5 bg-gold/10 ring-1 ring-gold/40">
              <Thumb src={currentThumb} fallback={currentSong.coverUrl} className="w-[104px]"><Equalizer playing={playing} /></Thumb>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gold line-clamp-2 leading-snug">{currentSong.title}</p>
                <p className="text-xs text-muted-foreground truncate">{currentSong.artist}</p>
              </div>
            </div>
            {repeatMode === "one" && <p className="mt-2 text-[11px] text-muted-foreground">Repeat one is on — this video will play again.</p>}
            {!autoplay && <p className="mt-2 text-[11px] text-muted-foreground">Autoplay is off — playback stops after this video.</p>}
          </div>
        )}
        {(rowCount > 0 || loadingFirst) && <p className="px-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Up Next</p>}
        {loadingFirst ? (
          <div className="px-4 space-y-2" aria-label="Loading Up Next">
            {[0, 1, 2, 3].map((i) => <div key={i} className="flex gap-3 items-center h-[68px]"><Skeleton className="w-[104px] aspect-video rounded-lg" /><div className="flex-1 space-y-2"><Skeleton className="h-3 w-3/4" /><Skeleton className="h-3 w-1/2" /></div></div>)}
          </div>
        ) : videos.status === "error" && upNext.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-sm text-foreground mb-3">Couldn't load Up Next.</p>
            <Button type="button" variant="secondary" className="h-11 gap-2" onClick={videos.retry}><RotateCcw className="w-4 h-4" /> Try again</Button>
          </div>
        ) : rowCount === 0 && !extending ? (
          filter ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">No videos in this category.</p>
          ) : (
            <div className="px-4 py-8 text-center">
              <Music className="w-8 h-8 mx-auto mb-2 text-gold/50" aria-hidden="true" />
              <p className="text-sm font-semibold text-foreground">Nothing up next</p>
              <Button type="button" className="mt-3 h-11 gradient-gold text-primary-foreground" onClick={browseVideos}>Browse Videos</Button>
            </div>
          )
        ) : (
          <div ref={rowsRef} role="list" aria-label="Up Next videos" className="relative" style={{ height: totalH }}>
            {rowNodes}
            {drag && drag.target !== drag.index && (
              <span className="absolute left-4 right-4 h-0.5 rounded-full bg-gold shadow-[0_0_8px_hsl(var(--gold))] pointer-events-none"
                style={{ top: drag.target > drag.index ? tops[drag.target] + ROW_H - 1 : tops[drag.target] - 1 }} aria-hidden="true" />
            )}
          </div>
        )}
        {(extending || (videos.status === "loading" && upNext.length > 0)) && (
          <div className="px-4 pt-2 space-y-2" aria-label="Loading more videos">
            {[0, 1].map((i) => <div key={i} className="flex gap-3 items-center h-[68px]"><Skeleton className="w-[104px] aspect-video rounded-lg" /><div className="flex-1 space-y-2"><Skeleton className="h-3 w-3/4" /><Skeleton className="h-3 w-1/2" /></div></div>)}
          </div>
        )}
        {videos.status === "error" && upNext.length > 0 && (
          <div className="px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">Some videos couldn't load.</p>
            <Button type="button" variant="secondary" size="sm" className="h-11" onClick={videos.retry}>Retry</Button>
          </div>
        )}
        {exhausted && autoplay && rowCount > 0 && (
          <div className="px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">No more videos found right now.</p>
            <Button type="button" variant="secondary" size="sm" className="h-11 gap-1.5" onClick={() => setExhausted(false)}><Plus className="w-4 h-4" /> Try again</Button>
          </div>
        )}
      </div>
    </>
  );

  const dialogs = (
    <>
      {playlistSong && (
        <AddToPlaylistModal open={!!playlistSong} onOpenChange={(o) => { if (!o) setPlaylistSong(null); }} songId={playlistSong.id} songTitle={playlistSong.title} />
      )}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-base">Save Up Next as a playlist</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveQueue(); }} className="space-y-3">
            <Input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="Playlist name" aria-label="Playlist name" maxLength={100} />
            <Button type="submit" className="w-full h-11 gradient-gold text-primary-foreground" disabled={!saveName.trim() || saving}>
              {saving ? "Saving…" : `Save ${new Set([currentSong?.id, ...upNext.map((qi) => queue[qi]?.id)].filter(Boolean)).size} videos`}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );

  if (!currentSong || isKaraoke) return null;

  // ---------------- Desktop: right-side panel ----------------
  if (!isSheet) {
    return (
      <aside aria-label="Up Next" className="w-[360px] xl:w-[400px] flex-shrink-0 min-h-0 flex flex-col rounded-3xl glass-card bg-card/70 backdrop-blur-xl border border-border overflow-hidden pt-3">
        {header}
        {list}
        {dialogs}
      </aside>
    );
  }

  // ---------------- Mobile: bottom sheet ----------------
  return (
    <>
      <div ref={safeProbeRef} aria-hidden="true" className="fixed left-0 bottom-0 w-0 pointer-events-none invisible" style={{ height: "env(safe-area-inset-bottom, 0px)" }} />
      <section
        ref={sheetRef}
        aria-label="Up Next"
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
          {/* Expanded: pinned mini video + controls */}
          <div ref={miniRowRef} className="relative flex items-center gap-2 px-3 pb-2 pt-1" aria-hidden={!open}>
            <div ref={miniSlotRef} className="w-[40%] max-w-[240px] aspect-video rounded-lg flex-shrink-0 bg-muted/40">
              {/* The real video is moved here; this button sits beneath it and restores the full view. */}
              <button type="button" onClick={() => onOpenChange(false)} tabIndex={open ? 0 : -1} aria-label="Show full video" className="w-full h-full rounded-lg" />
            </div>
            <MiniControls status={status} onNext={onNext} title={currentSong.title} artist={currentSong.artist} />
          </div>
          {/* Collapsed: peek row */}
          <div
            ref={peekRef}
            role="button"
            tabIndex={open ? -1 : 0}
            aria-label={nextSong ? `Up Next: ${nextSong.title}. ${countLabel}. Open list` : "Open Up Next"}
            onPointerDown={(e) => { e.stopPropagation(); onDragDown("handle")(e); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenChange(true); } }}
            className="absolute inset-x-0 top-0 h-16 flex items-center gap-3 px-4 bg-card"
          >
            {nextSong ? (
              <Thumb src={nextThumb} fallback={nextSong.coverUrl} className="w-[72px]" />
            ) : (
              <div className="w-[72px] aspect-video rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0"><Video className="w-4 h-4 text-gold/50" /></div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gold">Up Next</p>
              <p className="text-sm font-medium text-foreground truncate">{nextSong ? nextSong.title : loadingFirst ? "Loading…" : "Nothing up next"}</p>
              {upNext.length > 0 && <p className="text-[11px] text-muted-foreground truncate">{countLabel}</p>}
            </div>
            <ChevronUp className="w-5 h-5 text-muted-foreground flex-shrink-0" aria-hidden="true" />
          </div>
        </div>

        <div ref={bodyRef} className="flex-1 min-h-0 flex flex-col" aria-hidden={!open}>
          {header}
          {list}
        </div>
      </section>
      {dialogs}
    </>
  );
};

export default UpNextSheet;
