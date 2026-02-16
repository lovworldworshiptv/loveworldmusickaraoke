import type { Song } from "@/data/mockData";
import SongCard from "./SongCard";

interface SongSectionProps {
  title: string;
  songs: Song[];
}

const SongSection = ({ title, songs }: SongSectionProps) => {
  return (
    <section className="px-4 lg:px-6 mt-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-serif font-bold text-foreground">{title}</h3>
        <button className="text-xs text-gold hover:underline font-medium">See All</button>
      </div>
      <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
        {songs.map((song, i) => (
          <SongCard key={song.id} song={song} index={i} />
        ))}
      </div>
    </section>
  );
};

export default SongSection;
