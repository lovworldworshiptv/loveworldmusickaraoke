import AppLayout from "@/components/layout/AppLayout";
import { useNavigate } from "react-router-dom";
import { Music, BookOpen, Play, Star, Lock } from "lucide-react";

const Games = () => {
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-6 lg:pt-10 pb-8 max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl lg:text-4xl font-serif font-bold text-foreground mb-2">
            Games Hub
          </h1>
          <p className="text-muted-foreground">
            Learn. Play. Grow. Test your music knowledge!
          </p>
        </div>

        {/* Game Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* SongMatch Card */}
          <button
            onClick={() => navigate("/games/songmatch")}
            className="glass-card p-6 text-left hover:ring-2 hover:ring-primary/50 transition-all duration-300 group relative"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-4 shadow-lg">
              <Music className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">SongMatch</h3>
            <p className="text-sm text-muted-foreground mb-5 line-clamp-2">
              Learn and recognize Loveworld praise and worship songs through lyrics, melodies, and categories.
            </p>
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium group-hover:opacity-90 transition-opacity">
              <Play className="w-4 h-4" />
              Play Now
            </div>
          </button>

          {/* Build & Learn Card (Coming Soon) */}
          <div className="glass-card p-6 text-left relative opacity-70">
            <div className="absolute top-4 right-4">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-muted-foreground text-xs font-medium">
                <Lock className="w-3 h-3" />
                Coming Soon
              </span>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-4 shadow-lg">
              <BookOpen className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Build & Learn</h3>
            <p className="text-sm text-muted-foreground mb-5 line-clamp-2">
              An interactive learning experience for ministry knowledge and growth.
            </p>
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-muted text-muted-foreground text-sm font-medium cursor-not-allowed">
              <Star className="w-4 h-4" />
              Coming Soon
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Games;
