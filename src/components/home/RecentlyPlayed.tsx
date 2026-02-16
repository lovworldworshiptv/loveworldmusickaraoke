import { Clock, Play } from "lucide-react";
import { usePlayer, type PlayerSong } from "@/contexts/PlayerContext";

const RecentlyPlayed = () => {
  const { currentSong, isPlaying, playSong } = usePlayer();

  if (!currentSong) {
    return (
      <section className="px-4 lg:px-6 mt-8 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-serif font-bold text-foreground">Recently Played</h3>
        </div>
        <div className="glass-card p-8 text-center">
          <Clock className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Songs you listen to will appear here</p>
        </div>
      </section>
    );
  }

  return (
    <section className="px-4 lg:px-6 mt-8 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-serif font-bold text-foreground">Recently Played</h3>
      </div>
      <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
        <button
          onClick={() => playSong(currentSong)}
          className="flex-shrink-0 w-40 glass-card p-3 hover:glow-gold transition-all duration-300 text-left group hover:-translate-y-1"
        >
          <div className="w-full aspect-square rounded-xl gradient-purple flex items-center justify-center mb-3 relative overflow-hidden">
            {currentSong.coverUrl ? (
              <img src={currentSong.coverUrl} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
            ) : (
              <Play className="w-8 h-8 text-gold/40" />
            )}
            {isPlaying && (
              <div className="absolute bottom-2 right-2 flex gap-0.5 items-end h-4">
                <div className="w-0.5 h-2 bg-gold rounded-full animate-pulse" />
                <div className="w-0.5 h-3 bg-gold rounded-full animate-pulse" style={{ animationDelay: "0.15s" }} />
                <div className="w-0.5 h-4 bg-gold rounded-full animate-pulse" style={{ animationDelay: "0.3s" }} />
              </div>
            )}
          </div>
          <p className="text-xs font-medium text-foreground truncate group-hover:text-gold transition-colors duration-200">{currentSong.title}</p>
          <p className="text-[10px] text-muted-foreground truncate">{currentSong.artist}</p>
        </button>
      </div>
    </section>
  );
};

export default RecentlyPlayed;
