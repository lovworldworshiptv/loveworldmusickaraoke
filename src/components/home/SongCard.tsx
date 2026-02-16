import { Play, Pause } from "lucide-react";
import type { Song } from "@/data/mockData";
import { usePlayer, type PlayerSong } from "@/contexts/PlayerContext";

interface SongCardProps {
  song: Song;
  index: number;
}

const SongCard = ({ song, index }: SongCardProps) => {
  const { playSong, currentSong, isPlaying } = usePlayer();
  const isActive = currentSong?.id === song.id;

  const handlePlay = () => {
    const ps: PlayerSong = {
      id: song.id, title: song.title, artist: song.artist,
      coverUrl: song.coverUrl, durationSeconds: 240,
      lyricsLrc: `[00:00.00]${song.title}\n[00:05.00]By ${song.artist}\n[00:10.00]Verse 1\n[00:15.00]Singing to the Lord\n[00:20.00]With all my heart\n[00:25.00]You are worthy\n[00:30.00]Of all the praise\n[00:35.00]Chorus\n[00:40.00]Hallelujah\n[00:45.00]Glory to God\n[00:50.00]Forever and ever\n[00:55.00]Amen`,
    };
    playSong(ps);
  };

  return (
    <div className="group flex-shrink-0 w-40 md:w-44">
      <div className={`relative aspect-square rounded-xl overflow-hidden mb-3 glass-card ${isActive ? "ring-2 ring-primary glow-gold" : ""}`}>
        <div className="w-full h-full gradient-purple flex items-center justify-center">
          <span className="text-3xl font-serif font-bold text-gold opacity-40">{index + 1}</span>
        </div>
        <div className="absolute inset-0 bg-background/0 group-hover:bg-background/30 transition-all duration-300 flex items-center justify-center">
          <button onClick={handlePlay}
            className="w-12 h-12 rounded-full gradient-gold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-75 group-hover:scale-100">
            {isActive && isPlaying ? <Pause className="w-5 h-5 text-primary-foreground" /> : <Play className="w-5 h-5 text-primary-foreground ml-0.5" />}
          </button>
        </div>
      </div>
      <p className="text-sm font-medium text-foreground truncate">{song.title}</p>
      <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
    </div>
  );
};

export default SongCard;
