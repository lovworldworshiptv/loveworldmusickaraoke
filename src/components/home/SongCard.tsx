import { Play, Pause, Music, Download } from "lucide-react";
import { usePlayer, type PlayerSong } from "@/contexts/PlayerContext";
import { memo, useState, useEffect, useCallback } from "react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useIsPremium } from "@/hooks/useIsPremium";
import { isDownloaded as checkDownloaded, saveDownload } from "@/lib/downloadManager";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown } from "lucide-react";

interface SongCardProps {
  song: PlayerSong;
  index: number;
  allSongs?: PlayerSong[];
}

const SongCard = memo(({ song, index, allSongs }: SongCardProps) => {
  const { playSong, playQueue, currentSong, isPlaying } = usePlayer();
  const { isAdmin } = useIsAdmin();
  const { isPremium } = useIsPremium();
  const isActive = currentSong?.id === song.id;
  const canDl = isPremium;

  const [dlState, setDlState] = useState<"none" | "downloading" | "done">("none");
  const [showUpgrade, setShowUpgrade] = useState(false);

  useEffect(() => {
    checkDownloaded(song.id).then(d => setDlState(d ? "done" : "none"));
  }, [song.id]);

  const handlePlay = () => {
    if (allSongs && allSongs.length > 1) {
      playQueue(allSongs, index);
    } else {
      playSong(song);
    }
  };

  const handleDownload = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!song.audioUrl) return;
    if (!canDl) {
      setShowUpgrade(true);
      return;
    }
    if (dlState === "done" || dlState === "downloading") return;
    setDlState("downloading");
    try {
      await saveDownload(song.id, song.audioUrl, {
        id: song.id, title: song.title, artist: song.artist,
        coverUrl: song.coverUrl, lyricsLrc: song.lyricsLrc,
        durationSeconds: song.durationSeconds || 0, album: song.album,
        downloadedAt: Date.now(),
      }, song.instrumentalUrl);
      setDlState("done");
      toast.success(`"${song.title}" saved for offline`);
    } catch {
      setDlState("none");
      toast.error("Download failed");
    }
  }, [song, canDl, dlState]);

  return (
    <>
      <div
        className="group flex-shrink-0 w-40 md:w-44 animate-fade-in-up gpu"
        style={{ animationDelay: `${index * 0.07}s` }}
      >
        <div className={`relative aspect-square rounded-xl overflow-hidden mb-3 glass-card transition-all duration-300 group-hover:shadow-[0_8px_32px_hsl(43_70%_53%/0.12)] active:scale-95 ${isActive ? "ring-2 ring-primary glow-gold" : ""}`}>
          {song.coverUrl ? (
            <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 will-change-transform" loading="lazy" decoding="async" />
          ) : (
            <div className="w-full h-full gradient-purple flex items-center justify-center">
              <Music className="w-8 h-8 text-gold/30" />
            </div>
          )}
          <div className="absolute inset-0 bg-background/0 group-hover:bg-background/20 transition-all duration-300 flex items-center justify-center">
            <button onClick={handlePlay}
              className="w-12 h-12 rounded-full bg-gradient-to-br from-gold via-gold-light to-gold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 scale-75 group-hover:scale-100 shadow-[0_4px_24px_hsl(43_70%_53%/0.55)] backdrop-blur-sm ring-2 ring-white/20 touch-target active:scale-90 hover:shadow-[0_6px_32px_hsl(43_70%_53%/0.7)]">
              {isActive && isPlaying ? <Pause className="w-5 h-5 text-white drop-shadow-sm" fill="currentColor" /> : <Play className="w-5 h-5 text-white ml-0.5 drop-shadow-sm" fill="currentColor" />}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <p className="text-sm font-medium text-foreground truncate flex-1 group-hover:text-gold transition-colors duration-200">{song.title}</p>
          {song.audioUrl && (
            dlState === "done" ? (
              <Download className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
            ) : (
              <button onClick={handleDownload} className="flex-shrink-0 p-0.5">
                <Download className={`w-3.5 h-3.5 ${dlState === "downloading" ? "animate-pulse text-gold" : "text-muted-foreground"}`} />
              </button>
            )
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
      </div>

      <Dialog open={showUpgrade} onOpenChange={setShowUpgrade}>
        <DialogContent className="max-w-sm text-center">
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-16 h-16 rounded-full bg-gold/20 flex items-center justify-center">
              <Crown className="w-8 h-8 text-gold" />
            </div>
            <h3 className="text-xl font-serif font-bold text-foreground">Upgrade to Premium</h3>
            <p className="text-sm text-muted-foreground">Download songs for offline playback, access karaoke mode, and more — starting at just 2 Espees/month!</p>
            <Button className="gradient-gold text-primary-foreground w-full" onClick={() => { setShowUpgrade(false); window.location.href = "/subscription"; }}>
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
});

SongCard.displayName = "SongCard";
export default SongCard;
