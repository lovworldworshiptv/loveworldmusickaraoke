import AppLayout from "@/components/layout/AppLayout";
import { useNavigate } from "react-router-dom";
import { Music, BookOpen, Lock, Trophy, Gamepad2, Star, Target, Share2 } from "lucide-react";
import { useGameStats, ACHIEVEMENTS } from "@/hooks/useGameStats";
import ShareMenu, { buildShareUrl } from "@/components/share/ShareMenu";
import ChallengeBanner from "@/components/games/ChallengeBanner";

const Games = () => {
  const navigate = useNavigate();
  const { data: stats } = useGameStats();

  const earnedCount = stats?.achievements.length || 0;

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-6 lg:pt-10 pb-8 max-w-3xl mx-auto">
        {/* Song Match Challenge - placed first for maximum visibility */}
        <ChallengeBanner />

        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl lg:text-4xl font-serif font-bold text-foreground mb-2">
            Games Hub
          </h1>
          <p className="text-muted-foreground text-sm">
            Learn. Play. Grow. Test your music knowledge!
          </p>
        </div>

        {/* Global Stats */}
        {stats && stats.totalGamesPlayed > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="glass-card p-4 text-center animate-fade-in">
              <Gamepad2 className="w-5 h-5 text-primary mx-auto mb-1" />
              <p className="text-2xl font-bold text-foreground">{stats.totalGamesPlayed}</p>
              <p className="text-xs text-muted-foreground">Games Played</p>
            </div>
            <div className="glass-card p-4 text-center animate-fade-in" style={{ animationDelay: "0.1s" }}>
              <Star className="w-5 h-5 text-amber-400 mx-auto mb-1" />
              <p className="text-2xl font-bold text-foreground">{stats.totalPoints}</p>
              <p className="text-xs text-muted-foreground">Total Points</p>
            </div>
            <div className="glass-card p-4 text-center animate-fade-in" style={{ animationDelay: "0.2s" }}>
              <Trophy className="w-5 h-5 text-amber-400 mx-auto mb-1" />
              <p className="text-2xl font-bold text-foreground">{earnedCount}</p>
              <p className="text-xs text-muted-foreground">Achievements</p>
            </div>
          </div>
        )}

        {/* Game Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
          {/* SongMatch Card */}
          <button
            onClick={() => navigate("/games/songmatch")}
            className="glass-card p-6 text-left hover:ring-2 hover:ring-primary/50 transition-all duration-300 group relative animate-scale-in"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300">
              <Music className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">SongMatch</h3>
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
              Learn and recognize Loveworld praise and worship songs through lyrics, melodies, and categories.
            </p>
            {stats && stats.totalGamesPlayed > 0 && (
              <div className="flex items-center gap-3 mb-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Target className="w-3 h-3" /> {stats.totalGamesPlayed} played</span>
                <span className="flex items-center gap-1"><Star className="w-3 h-3" /> {stats.totalPoints} pts</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium group-hover:opacity-90 transition-opacity">
                Play Now
              </div>
              <div onClick={(e) => e.stopPropagation()}>
                <ShareMenu
                  url={buildShareUrl("/games/songmatch")}
                  title="SongMatch Challenge"
                  text="I challenge you to play SongMatch! Test your music knowledge on Loveworld Music Karaoke+"
                  trigger={
                    <button className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-border text-foreground text-sm font-medium hover:bg-accent transition-colors">
                      <Share2 className="w-4 h-4" /> Invite
                    </button>
                  }
                />
              </div>
            </div>
          </button>

          {/* Build & Learn Card (Coming Soon) */}
          <div className="glass-card p-6 text-left relative opacity-70 animate-scale-in" style={{ animationDelay: "0.1s" }}>
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
              Coming Soon
            </div>
          </div>
        </div>

        {/* Achievements Section */}
        {stats && (
          <div className="glass-card p-6 animate-fade-in">
            <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" /> Achievements
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {ACHIEVEMENTS.map((ach) => {
                const earned = stats.achievements.includes(ach.key);
                return (
                  <div
                    key={ach.key}
                    className={`text-center p-3 rounded-xl transition-all duration-300 ${earned ? "bg-amber-500/10" : "bg-muted/50 opacity-50"}`}
                  >
                    <span className="text-2xl block mb-1">{ach.icon}</span>
                    <p className="text-xs font-semibold text-foreground">{ach.label}</p>
                    <p className="text-[10px] text-muted-foreground">{ach.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Games;
