import { createPortal } from "react-dom";
import { Play } from "lucide-react";
import { usePlayer } from "@/contexts/PlayerContext";

/**
 * Shown only when a scanned/shared song was loaded but the phone refused to start
 * sound on its own. One tap anywhere starts it (play() runs inside the tap).
 */
const SharedSongTapToPlay = ({ songId, onDone }: { songId: string; onDone: () => void }) => {
  const { currentSong, autoplayBlocked, isPlaying, togglePlay } = usePlayer();
  if (!autoplayBlocked || isPlaying || currentSong?.id !== songId) return null;

  const start = () => {
    togglePlay();
    onDone();
  };

  return createPortal(
    <button
      type="button"
      onClick={start}
      aria-label={`Play ${currentSong.title}`}
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-6 bg-background/85 backdrop-blur-md px-6 text-center animate-in fade-in"
    >
      {currentSong.coverUrl && (
        <img
          src={currentSong.coverUrl}
          alt=""
          className="w-48 h-48 sm:w-60 sm:h-60 rounded-3xl object-cover shadow-[0_8px_40px_hsl(43_70%_53%/0.35)]"
        />
      )}
      <div className="max-w-xs">
        <p className="text-xl font-serif font-bold text-foreground line-clamp-2">{currentSong.title}</p>
        <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{currentSong.artist}</p>
      </div>
      <span className="w-20 h-20 rounded-full gradient-gold flex items-center justify-center shadow-[0_4px_32px_hsl(43_70%_53%/0.55)] animate-pulse motion-reduce:animate-none">
        <Play className="w-9 h-9 text-primary-foreground fill-current ml-1" />
      </span>
      <p className="text-sm font-semibold text-gold">Tap anywhere to play</p>
    </button>,
    document.body,
  );
};

export default SharedSongTapToPlay;
