import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronUp, Mic2, Music, Trash2 } from "lucide-react";
import { usePlayer, type PlayerSong } from "@/contexts/PlayerContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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

function KaraokeList({ onPicked }: { onPicked?: () => void }) {
  const { queue, queueIndex, currentSong, playQueueIndex, reorderQueue, removeFromQueue } = usePlayer();
  const upcoming = useMemo(() => queue.map((song, qi) => ({ song, qi })).filter((r) => r.qi > queueIndex), [queue, queueIndex]);
  const readyCount = upcoming.filter((r) => ready(r.song)).length;

  return (
    <div className="flex flex-col min-h-0 h-full">
      {currentSong && (
        <div className="px-4 pb-3">
          <p className="text-xs text-muted-foreground mb-2">Now singing</p>
          <div className="flex items-center gap-3 rounded-2xl bg-gold/10 border border-gold/30 p-2">
            <Cover song={currentSong} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gold truncate">{currentSong.title}</p>
              <p className="text-xs text-muted-foreground truncate">{currentSong.artist}</p>
            </div>
            <Mic2 className="w-4 h-4 text-gold flex-shrink-0" aria-hidden="true" />
          </div>
        </div>
      )}
      <div className="px-4 pb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">Up Next</h3>
        <span className="text-xs text-muted-foreground">{readyCount} ready to sing</span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-4">
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

/** Mobile: a peek bar under the controls that opens the full list. */
export function KaraokeUpNextBar() {
  const { queue, queueIndex } = usePlayer();
  const [open, setOpen] = useState(false);
  const next = queue.slice(queueIndex + 1).find(ready);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="flex-shrink-0 mx-4 mb-[max(0.5rem,env(safe-area-inset-bottom))] flex items-center gap-3 rounded-2xl glass-card px-3 py-2 min-h-14 text-left">
        {next ? <Cover song={next} size={40} /> : <Mic2 className="w-5 h-5 text-gold" aria-hidden="true" />}
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-muted-foreground">Up Next</span>
          <span className="block text-sm font-medium truncate">{next ? next.title : "Karaoke queue"}</span>
        </span>
        <ChevronUp className="w-5 h-5 text-gold" aria-hidden="true" />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="h-[75dvh] rounded-t-3xl px-0 flex flex-col">
          <SheetHeader className="px-4 pb-2"><SheetTitle>Karaoke queue</SheetTitle></SheetHeader>
          <div className="flex-1 min-h-0"><KaraokeList onPicked={() => setOpen(false)} /></div>
        </SheetContent>
      </Sheet>
    </>
  );
}
