import { Play, SkipBack, SkipForward, Shuffle, Repeat, Volume2, Mic2, ListMusic } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { useState } from "react";

const PlayerBar = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState([35]);

  return (
    <div className="fixed bottom-12 lg:bottom-0 left-0 lg:left-64 right-0 z-30 glass border-t border-border">
      <div className="px-4 pt-2">
        <Slider
          value={progress}
          onValueChange={setProgress}
          max={100}
          step={1}
          className="w-full h-1"
        />
      </div>

      <div className="flex items-center justify-between px-4 py-3">
        {/* Song Info */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-lg gradient-gold flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate text-foreground">None Like You</p>
            <p className="text-xs text-muted-foreground truncate">Loveworld Singers</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 md:gap-4">
          <button className="hidden md:block text-muted-foreground hover:text-foreground transition-colors">
            <Shuffle className="w-4 h-4" />
          </button>
          <button className="text-muted-foreground hover:text-foreground transition-colors">
            <SkipBack className="w-5 h-5" />
          </button>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-10 h-10 rounded-full gradient-gold flex items-center justify-center text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <Play className={`w-5 h-5 ${isPlaying ? "hidden" : ""}`} />
            {isPlaying && (
              <div className="flex gap-0.5">
                <div className="w-1 h-4 bg-primary-foreground rounded-full" />
                <div className="w-1 h-4 bg-primary-foreground rounded-full" />
              </div>
            )}
          </button>
          <button className="text-muted-foreground hover:text-foreground transition-colors">
            <SkipForward className="w-5 h-5" />
          </button>
          <button className="hidden md:block text-muted-foreground hover:text-foreground transition-colors">
            <Repeat className="w-4 h-4" />
          </button>
        </div>

        {/* Right Controls */}
        <div className="hidden md:flex items-center gap-3 flex-1 justify-end">
          <button className="text-gold hover:opacity-80 transition-opacity">
            <Mic2 className="w-4 h-4" />
          </button>
          <button className="text-muted-foreground hover:text-foreground transition-colors">
            <ListMusic className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 w-28">
            <Volume2 className="w-4 h-4 text-muted-foreground" />
            <Slider defaultValue={[70]} max={100} step={1} className="flex-1" />
          </div>
          <span className="text-xs text-muted-foreground w-16 text-right">1:35 / 4:32</span>
        </div>
      </div>
    </div>
  );
};

export default PlayerBar;
