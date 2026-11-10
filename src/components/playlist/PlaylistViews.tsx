import { useState, type ReactNode } from "react";
import { ArrowLeft, ChevronRight, ListMusic } from "lucide-react";

type PreviewSong = { title?: string | null; artist?: string | null };

const songCount = (n: number) => `${n} ${n === 1 ? "song" : "songs"}`;

function Cover({ cover, name, className }: { cover: string | null; name: string; className: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <div className={`${className} shrink-0 overflow-hidden bg-primary/10 flex items-center justify-center`}>
      {cover && cover !== failed
        ? <img src={cover} alt={`${name} artwork`} loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" onError={() => setFailed(cover)} />
        : <ListMusic className="w-1/3 h-1/3 text-primary transition-colors duration-300 group-hover:text-gold" />}
    </div>
  );
}

/** Compact playlist card: thumbnail, name, song count and the first three songs. Tapping opens the playlist. */
export function PlaylistPreviewCard({ cover, name, count, songs, onOpen, badge, actions, highlighted }: {
  cover: string | null; name: ReactNode; count: number; songs: PreviewSong[]; onOpen: () => void;
  badge?: ReactNode; actions?: ReactNode; highlighted?: boolean;
}) {
  const label = typeof name === "string" ? name : "playlist";
  const firstThree = songs.slice(0, 3);
  return (
    <div
      onClick={onOpen}
      className={`group cursor-pointer rounded-xl border p-3 flex gap-3 items-start transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_10px_36px_hsl(43_70%_53%/0.22)] active:translate-y-0 active:scale-[0.99] ${highlighted ? "border-gold shadow-[0_0_24px_hsl(43_70%_53%/0.5)]" : "border-border hover:border-gold/60"}`}
    >
      <button onClick={onOpen} aria-label={`Open ${label}`} className="shrink-0 rounded-xl ring-1 ring-transparent transition-all duration-300 group-hover:ring-gold/50">
        <Cover cover={cover} name={label} className="w-20 h-20 rounded-xl" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <button onClick={onOpen} className="flex-1 min-w-0 text-left">
            <h3 className="font-semibold text-foreground truncate transition-colors duration-300 group-hover:text-gold">{name}</h3>
            <p className="text-xs text-muted-foreground flex items-center gap-2 transition-colors duration-300 group-hover:text-foreground/70">
              {songCount(count)}{badge}
              <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-0 -translate-x-1 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0" />
            </p>
          </button>
          {actions && <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>{actions}</div>}
        </div>
        {firstThree.length > 0 ? (
          <ul className="mt-1.5 space-y-0.5">
            {firstThree.map((s, i) => (
              <li key={i} className="flex items-center gap-1.5 min-w-0">
                <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-gold shrink-0 transition-colors duration-300 group-hover:bg-gold-light" />
                <span className="text-xs truncate text-foreground/80 min-w-0 transition-colors duration-300 group-hover:text-foreground">
                  {s.title}
                  {s.artist && <span className="text-muted-foreground"> · {s.artist}</span>}
                </span>
              </li>
            ))}
          </ul>
        ) : <p className="mt-1.5 text-xs text-muted-foreground">No songs yet</p>}
      </div>
    </div>
  );
}

/** Opened playlist header: back button, large artwork, name and song count. */
export function PlaylistHero({ cover, name, count, onBack, badge, actions }: {
  cover: string | null; name: ReactNode; count: number; onBack: () => void; badge?: ReactNode; actions?: ReactNode;
}) {
  const label = typeof name === "string" ? name : "playlist";
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border mb-4">
      {cover && <img src={cover} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover blur-2xl scale-125 opacity-40" />}
      <div className="absolute inset-0 bg-gradient-to-b from-background/30 to-background" />
      <div className="relative p-4">
        <button onClick={onBack} aria-label="Back to playlists" className="w-9 h-9 rounded-full bg-background/60 backdrop-blur flex items-center justify-center mb-3 transition-all duration-200 hover:bg-background/80 hover:scale-105 active:scale-95">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4">
          <Cover cover={cover} name={label} className="w-40 h-40 rounded-2xl shadow-[0_8px_32px_hsl(43_70%_53%/0.35)] transition-shadow duration-500 hover:shadow-[0_12px_44px_hsl(43_70%_53%/0.5)]" />
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Playlist {badge}</p>
            <h2 className="text-2xl font-serif font-bold text-foreground break-words">{name}</h2>
            <p className="text-sm text-muted-foreground">{songCount(count)}</p>
            {actions && <div className="flex flex-wrap gap-1 justify-center sm:justify-start mt-2">{actions}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
