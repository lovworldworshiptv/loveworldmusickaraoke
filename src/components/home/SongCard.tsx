import { Play, Pause, Music } from "lucide-react";
import { usePlayer, type PlayerSong } from "@/contexts/PlayerContext";
import { memo } from "react";

interface SongCardProps {
  song: PlayerSong;
  index: number;
  allSongs?: PlayerSong[];
}

const SongCard = memo(({ song, index, allSongs }: SongCardProps) => {
  const { playSong, playQueue, currentSong, isPlaying } = usePlayer();
  const isActive = currentSong?.id === song.id;

  const handlePlay = () => {
    if (allSongs && allSongs.length > 1) {
      playQueue(allSongs, index);
    } else {
      playSong(song);
    }
  };

  return (
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
            {isActive && isPlaying ? <Pause className="w-5 h-5 text-primary-foreground drop-shadow-sm" fill="currentColor" /> : <Play className="w-5 h-5 text-primary-foreground ml-0.5 drop-shadow-sm" fill="currentColor" />}
          </button>
        </div>
      </div>
      <p className="text-sm font-medium text-foreground truncate group-hover:text-gold transition-colors duration-200">{song.title}</p>
      <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
    </div>
  );
});

SongCard.displayName = "SongCard";
export default SongCard;