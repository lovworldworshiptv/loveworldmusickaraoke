import ArtistLinks from "@/components/artist/ArtistLinks";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Mic2, Music, Pause, Play, Plus, Save, SkipForward } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useFeatures } from "@/contexts/FeatureContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AddToPlaylistModal from "@/components/playlist/AddToPlaylistModal";
import { usePlayer, type PlayerSong } from "@/contexts/PlayerContext";
import { PEEK_HEIGHT, ROW_H, QueueRow, Thumb, Equalizer, fmtTotal, type RowItem } from "@/components/player/UpNextSheet";

/** Karaoke-ready = the song has a backing track; Karaoke mode skips the rest. */
const ready = (s: PlayerSong) => !!s.instrumentalUrl;

function Cover({ song, size = 48 }: { song: PlayerSong; size?: number }) {
  return (
    <div className="rounded-lg bg-muted/50 overflow-hidden flex-shrink-0 flex items-center justify-center" style={{ width: size, height: size }}>
      {song.coverUrl ? <img src={song.coverUrl} alt="" className="w-full h-full object-cover" /> : <Music className="w-4 h-4 text-gold/50" aria-hidden="true" />}
    </div>
  );
}

function KaraokeList({ onPicked, scrollerRef: extRef, isSheet, onCollapse }: { onPicked?: () => void; scrollerRef?: RefObject<HTMLDivElement>; isSheet?: boolean; onCollapse?: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { enabled } = useFeatures();
  const { queue, queueIndex, currentSong, isPlaying, repeatMode, playQueueIndex, reorderQueue, removeFromQueue, playNextInQueue, insertIntoQueue, extendQueue, autoAddedIds, toggleExpanded } = usePlayer();
  const upNext = useMemo(() => queue.map((_, qi) => qi).filter((qi) => qi > queueIndex), [queue, queueIndex]);
  const readyCount = upNext.filter((qi) => ready(queue[qi])).length;
  const totalSeconds = upNext.reduce((sum, qi) => sum + (ready(queue[qi]) ? queue[qi].durationSeconds || 0 : 0), 0);
  const countLabel = `${readyCount} ${readyCount === 1 ? "song" : "songs"} ready to sing${totalSeconds ? ` · ${fmtTotal(totalSeconds)}` : ""}`;

  const items = useMemo<RowItem[]>(() => {
    const out: RowItem[] = [];
    let dividerShown = false;
    upNext.forEach((qi) => {
      const song = queue[qi];
      const auto = autoAddedIds.has(song.id);
      if (auto && !dividerShown) { out.push({ kind: "divider" }); dividerShown = true; }
      out.push({ kind: "row", qi, song, auto });
    });
    return out;
  }, [upNext, queue, autoAddedIds]);
  const tops = useMemo(() => {
    const t: number[] = []; let y = 0;
    items.forEach((it) => { t.push(y); y += it.kind === "row" ? ROW_H : 40; });
    t.push(y);
    return t;
  }, [items]);

  // More karaoke songs when the list runs low.
  const [extending, setExtending] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  useEffect(() => { setExhausted(false); }, [queue.length]);
  const loadMore = useCallback(async () => {
    if (extending || exhausted) return;
    setExtending(true);
    const added = await extendQueue("karaoke");
    setExtending(false);
    if (added < 0) setExhausted(true);
  }, [extending, exhausted, extendQueue]);
  useEffect(() => { if (readyCount < 5 && queue.length > 0) loadMore(); }, [readyCount, queue.length, loadMore]);

  const innerRef = useRef<HTMLDivElement>(null);
  const scrollerRef = extRef ?? innerRef;
  const rowsRef = useRef<HTMLDivElement>(null);
  const onScroll = () => {
    const sc = scrollerRef.current;
    if (sc && sc.scrollHeight - sc.scrollTop - sc.clientHeight < ROW_H * 3) loadMore();
  };

  // Drag to reorder (grip handle), same as Video.
  const [drag, setDrag] = useState<{ index: number; offset: number; target: number } | null>(null);
  const dragRef = useRef<{ index: number; startY: number; startScroll: number; y: number; raf: number | null } | null>(null);
  const rowIndexAt = (y: number) => {
    let best = -1, bestDist = Infinity;
    items.forEach((it, i) => { if (it.kind !== "row") return; const d = Math.abs(tops[i] + ROW_H / 2 - y); if (d < bestDist) { bestDist = d; best = i; } });
    return best;
  };
  const startDrag = (index: number) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const sc = scrollerRef.current;
    if (!sc) return;
    navigator.vibrate?.(8);
    dragRef.current = { index, startY: e.clientY, startScroll: sc.scrollTop, y: e.clientY, raf: null };
    setDrag({ index, offset: 0, target: index });
    const update = () => {
      const d = dragRef.current, s = scrollerRef.current, rows = rowsRef.current;
      if (!d || !s || !rows) return;
      const rect = s.getBoundingClientRect();
      if (d.y < rect.top + 56) s.scrollTop -= 10; else if (d.y > rect.bottom - 56) s.scrollTop += 10;
      const target = rowIndexAt(d.y - rows.getBoundingClientRect().top);
      setDrag({ index: d.index, offset: d.y - d.startY + (s.scrollTop - d.startScroll), target: target < 0 ? d.index : target });
      d.raf = requestAnimationFrame(update);
    };
    dragRef.current.raf = requestAnimationFrame(update);
    const move = (ev: PointerEvent) => { if (dragRef.current) dragRef.current.y = ev.clientY; };
    const up = () => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
      const d = dragRef.current; dragRef.current = null;
      if (d?.raf) cancelAnimationFrame(d.raf);
      setDrag((cur) => {
        if (cur && cur.target !== cur.index) {
          const from = items[cur.index], to = items[cur.target];
          if (from?.kind === "row" && to?.kind === "row") reorderQueue(from.qi, to.qi);
        }
        return null;
      });
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  };

  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [playlistSong, setPlaylistSong] = useState<PlayerSong | null>(null);
  const removeWithUndo = (qi: number) => {
    const song = queue[qi];
    if (!song) return;
    removeFromQueue(qi);
    toast(`Removed “${song.title}”`, { action: { label: "Undo", onClick: () => insertIntoQueue(song, qi) }, duration: 5000 });
  };

  // Save as playlist, same as Video.
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const canSave = !!user && enabled("playlists");
  const saveIds = [...new Set([currentSong?.id, ...upNext.map((qi) => queue[qi]?.id)].filter(Boolean) as string[])];
  const saveQueue = async () => {
    if (!user || !saveName.trim() || !saveIds.length) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.from("playlists").insert({ name: saveName.trim(), user_id: user.id }).select("id").single();
      if (error) throw error;
      const { error: e2 } = await supabase.from("playlist_songs").insert(saveIds.map((song_id, i) => ({ playlist_id: data.id, song_id, sort_order: i })));
      if (e2) throw e2;
      toast.success(`Saved ${saveIds.length} songs to “${saveName.trim()}”`);
      setSaveOpen(false);
    } catch { toast.error("Couldn't save the playlist — try again"); } finally { setSaving(false); }
  };

  const rowNodes: ReactNode[] = [];
  items.forEach((it, i) => {
    if (it.kind === "divider") {
      rowNodes.push(
        <div key="divider" className="absolute left-0 right-0 px-4 flex items-center gap-3" style={{ top: tops[i], height: 40 }}>
          <span className="h-px flex-1 bg-gold/30" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-gold">More karaoke for you</span>
          <span className="h-px flex-1 bg-gold/30" />
        </div>,
      );
      return;
    }
    const ok = ready(it.song);
    const prevRow = items.slice(0, i).reverse().find((x) => x.kind === "row") as Extract<RowItem, { kind: "row" }> | undefined;
    const nextRow = items.slice(i + 1).find((x) => x.kind === "row") as Extract<RowItem, { kind: "row" }> | undefined;
    rowNodes.push(
      <div key={`${it.song.id}-${it.qi}`} className="absolute left-0 right-0" style={{ top: tops[i], height: ROW_H }}>
        <QueueRow
          square qi={it.qi} song={it.song} thumb={it.song.coverUrl ?? null} watched={null}
          dim={!ok} note={ok ? undefined : "No backing track — skipped"}
          playLabel={ok ? `Sing ${it.song.title} now` : `${it.song.title} has no backing track`}
          draggable canMoveUp={!!prevRow} canMoveDown={!!nextRow}
          menuOpen={menuFor === it.qi} setMenuOpen={(o) => setMenuFor(o ? it.qi : null)}
          canDownload={false} showDownload={false} showAddToPlaylist={canSave}
          dragging={drag?.index === i} dragOffset={drag?.index === i ? drag.offset : 0} swipeEnabled={!!isSheet}
          onPlay={() => { if (!ok) { toast("This song has no backing track yet"); return; } playQueueIndex(it.qi, { autoplay: true }); onPicked?.(); }}
          onPlayNext={() => playNextInQueue(it.qi)}
          onMoveUp={() => prevRow && reorderQueue(it.qi, prevRow.qi)}
          onMoveDown={() => nextRow && reorderQueue(it.qi, nextRow.qi)}
          onMoveToEnd={() => reorderQueue(it.qi, queue.length - 1)}
          onAddToPlaylist={() => setPlaylistSong(it.song)}
          onDownload={() => {}}
          onRemove={() => removeWithUndo(it.qi)}
          onDragStart={startDrag(i)}
        />
      </div>,
    );
  });

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="flex items-center gap-2 px-4 pt-1 pb-2 flex-shrink-0">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-serif font-bold text-foreground">Up Next</h3>
          <p className="text-[11px] text-foreground">{upNext.length ? countLabel : "Karaoke queue"}</p>
        </div>
        {canSave && (
          <Button type="button" variant="ghost" size="sm" className="h-11 gap-1.5 text-foreground hover:text-gold" disabled={!saveIds.length}
            onClick={() => { setSaveName(currentSong ? `Karaoke · ${currentSong.title}` : "Karaoke"); setSaveOpen(true); }}>
            <Save className="w-4 h-4" /> Save
          </Button>
        )}
        {isSheet && (
          <button type="button" onClick={onCollapse} aria-label="Collapse Up Next"
            className="h-11 w-11 flex items-center justify-center rounded-full text-foreground hover:text-gold hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold flex-shrink-0">
            <ChevronDown className="w-5 h-5" />
          </button>
        )}
      </div>
      <div ref={scrollerRef} onScroll={onScroll} className="relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))]">
        {currentSong && (
          <div className="px-4 pt-1 pb-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground mb-2">Now Singing</p>
            <div className="flex items-center gap-3 rounded-xl p-1.5 bg-gold/10 ring-1 ring-gold/40">
              <Thumb src={currentSong.coverUrl} className="w-[60px] !aspect-square"><Equalizer playing={isPlaying} /></Thumb>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gold line-clamp-2 leading-snug">{currentSong.title}</p>
                <p className="text-xs text-foreground truncate"><ArtistLinks artist={currentSong.artist} /></p>
              </div>
              <Mic2 className="w-4 h-4 text-gold flex-shrink-0 mr-1" aria-hidden="true" />
            </div>
            {repeatMode === "one" && <p className="mt-2 text-[11px] text-foreground">Repeat one is on — this song will play again.</p>}
          </div>
        )}
        {items.length > 0 && <p className="px-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-foreground">Up Next</p>}
        {items.length === 0 && !extending ? (
          <div className="px-4 py-8 text-center">
            <Music className="w-8 h-8 mx-auto mb-2 text-gold/50" aria-hidden="true" />
            <p className="text-sm font-semibold text-foreground">Nothing up next</p>
            <Button type="button" className="mt-3 h-11 gradient-gold text-primary-foreground" onClick={() => { navigate("/library"); toggleExpanded(); }}>Browse Songs</Button>
          </div>
        ) : (
          <div ref={rowsRef} role="list" aria-label="Up Next karaoke songs" className="relative" style={{ height: tops[tops.length - 1] || 0 }}>
            {rowNodes}
            {drag && drag.target !== drag.index && (
              <span className="absolute left-4 right-4 h-0.5 rounded-full bg-gold shadow-[0_0_8px_hsl(var(--gold))] pointer-events-none"
                style={{ top: drag.target > drag.index ? tops[drag.target] + ROW_H - 1 : tops[drag.target] - 1 }} aria-hidden="true" />
            )}
          </div>
        )}
        {extending && (
          <div className="px-4 pt-2 space-y-2" aria-label="Loading more songs">
            {[0, 1].map((i) => <div key={i} className="flex gap-3 items-center h-[68px]"><Skeleton className="w-[60px] aspect-square rounded-lg" /><div className="flex-1 space-y-2"><Skeleton className="h-3 w-3/4" /><Skeleton className="h-3 w-1/2" /></div></div>)}
          </div>
        )}
        {exhausted && items.length > 0 && (
          <div className="px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-xs text-foreground">No more karaoke songs found right now.</p>
            <Button type="button" variant="secondary" size="sm" className="h-11 gap-1.5" onClick={() => setExhausted(false)}><Plus className="w-4 h-4" /> Try again</Button>
          </div>
        )}
      </div>
      {playlistSong && (
        <AddToPlaylistModal open={!!playlistSong} onOpenChange={(o) => { if (!o) setPlaylistSong(null); }} songId={playlistSong.id} songTitle={playlistSong.title} />
      )}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-base">Save Up Next as a playlist</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveQueue(); }} className="space-y-3">
            <Input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="Playlist name" aria-label="Playlist name" maxLength={100} />
            <Button type="submit" className="w-full h-11 gradient-gold text-primary-foreground" disabled={!saveName.trim() || saving}>
              {saving ? "Saving…" : `Save ${saveIds.length} songs`}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Desktop: panel beside the lyrics. */
export function KaraokeUpNextPanel() {
  return (
    <aside aria-label="Karaoke Up Next" className="w-[360px] xl:w-[400px] flex-shrink-0 min-h-0 flex flex-col rounded-3xl glass-card bg-card/70 backdrop-blur-xl border border-border overflow-hidden pt-3">
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
              <p className="text-xs text-foreground truncate"><ArtistLinks artist={currentSong.artist} /></p>
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
              {readyCount > 0 && <p className="text-[11px] text-foreground truncate">{countLabel}</p>}
            </div>
            <ChevronUp className="w-5 h-5 text-foreground flex-shrink-0" aria-hidden="true" />
          </div>
        </div>

        <div ref={bodyRef} className="flex-1 min-h-0 flex flex-col" aria-hidden={!open}>
          <KaraokeList scrollerRef={scrollerRef} isSheet onCollapse={() => onOpenChange(false)} onPicked={() => onOpenChange(false)} />
        </div>
      </section>
    </>
  );
}
