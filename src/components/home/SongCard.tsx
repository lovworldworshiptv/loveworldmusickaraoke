import { Play } from "lucide-react";
import type { Song } from "@/data/mockData";

interface SongCardProps {
  song: Song;
  index: number;
}

const SongCard = ({ song, index }: SongCardProps) => {
  return (
    <div className="group flex-shrink-0 w-40 md:w-44">
      <div className="relative aspect-square rounded-xl overflow-hidden mb-3 glass-card">
        <div className="w-full h-full gradient-purple flex items-center justify-center">
          <span className="text-3xl font-serif font-bold text-gold opacity-40">
            {index + 1}
          </span>
        </div>
        <div className="absolute inset-0 bg-background/0 group-hover:bg-background/30 transition-all duration-300 flex items-center justify-center">
          <button className="w-12 h-12 rounded-full gradient-gold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-75 group-hover:scale-100">
            <Play className="w-5 h-5 text-primary-foreground ml-0.5" />
          </button>
        </div>
      </div>
      <p className="text-sm font-medium text-foreground truncate">{song.title}</p>
      <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
    </div>
  );
};

export default SongCard;
