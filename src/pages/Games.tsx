import AppLayout from "@/components/layout/AppLayout";
import { useNavigate } from "react-router-dom";
import { Music, Newspaper, Trophy, Gamepad2, Star, Target, Share2, ArrowRight, Sparkles } from "lucide-react";
import { useGameStats, ACHIEVEMENTS } from "@/hooks/useGameStats";
import ShareMenu, { buildShareUrl } from "@/components/share/ShareMenu";
import ChallengeBanner from "@/components/games/ChallengeBanner";
import GameHubCard from "@/components/games/GameHubCard";
import { Button } from "@/components/ui/button";
import { resolveGameCard, type GameCardKey, type GameCardSettings } from "@/lib/gameCards";
import { SETTING_KEYS, useSetting } from "@/lib/siteSettings";

const Games = () => {
  const navigate = useNavigate();
  const cardSettings = useSetting<GameCardSettings>(SETTING_KEYS.gameCards);
  const { data: stats } = useGameStats();
  const earnedCount = stats?.achievements.length || 0;

  const games = [
    {
      key: "songmatch", path: "/games/songmatch", icon: Music, title: "SongMatch", tag: "Music quiz",
      desc: "Learn and recognize Loveworld praise and worship songs through lyrics, melodies, and categories.",
      gradient: "from-gold/30 via-gold/10 to-transparent", iconBg: "gradient-gold",
      played: stats?.totalGamesPlayed ?? 0, points: stats?.totalPoints ?? 0,
      shareTitle: "Song Master Challenge", shareText: "I challenge you to play SongMatch! Test your music knowledge on Loveworld Music Karaoke+",
    },
    {
      key: "articles", path: "/games/songmatch/articles", icon: Newspaper, title: "Articles Game", tag: "Knowledge quiz",
      desc: "Test your knowledge of Loveworld articles, authors and categories.",
      gradient: "from-accent/50 via-accent/15 to-transparent", iconBg: "bg-accent",
      played: (stats as any)?.articlesGames ?? 0, points: (stats as any)?.articlesPoints ?? 0,
      shareTitle: "Articles Game", shareText: "I challenge you to the Articles Game on Loveworld Music Karaoke+",
    },
  ];

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-6 lg:pt-10 pb-10 max-w-4xl mx-auto">
        <ChallengeBanner />

        {/* Header */}
        <div className="relative overflow-hidden rounded-3xl glass-card p-6 lg:p-8 mb-6">
          <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-gold/20 blur-3xl" />
          <div className="relative flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl gradient-gold flex items-center justify-center shadow-lg glow-gold">
              <Gamepad2 className="h-7 w-7 text-primary-foreground" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">Play & Grow</p>
              <h1 className="text-3xl lg:text-4xl font-serif font-bold text-foreground leading-tight">Games Hub</h1>
              <p className="text-sm text-foreground/90 mt-1">Learn. Play. Grow. Test your music knowledge!</p>
            </div>
          </div>

          {stats && stats.totalGamesPlayed > 0 && (
            <div className="relative grid grid-cols-3 gap-3 mt-6">
              {[
                { icon: Gamepad2, value: stats.totalGamesPlayed, label: "Games" },
                { icon: Star, value: stats.totalPoints, label: "Points" },
                { icon: Trophy, value: earnedCount, label: "Badges" },
              ].map(({ icon: Icon, value, label }) => (
                <div key={label} className="rounded-2xl bg-background/40 border border-border/60 backdrop-blur p-3 text-center">
                  <Icon className="w-4 h-4 text-gold mx-auto mb-1" />
                  <p className="text-xl font-bold text-foreground tabular-nums">{value}</p>
                  <p className="text-[11px] uppercase tracking-wider text-foreground/80">{label}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Game cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {games.map(g => (
            <GameHubCard key={g.key} presentation={resolveGameCard(g.key as GameCardKey, cardSettings)} tag={g.tag} onPlay={() => navigate(g.path)}
              stats={g.played > 0 ? <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5"><Target className="w-3.5 h-3.5" />{g.played} played</span>
                <span className="flex items-center gap-1.5"><Star className="w-3.5 h-3.5" />{g.points} pts</span>
              </div> : undefined}>
              <ShareMenu url={buildShareUrl(g.path)} title={g.shareTitle} text={g.shareText}
                trigger={<Button variant="ghost" className="gap-1.5 rounded-full border border-foreground/40 text-foreground hover:bg-foreground/10 hover:text-foreground"><Share2 className="w-4 h-4" />Invite</Button>} />
            </GameHubCard>
          ))}
        </div>

        {/* Achievements */}
        {stats && (
          <div className="rounded-3xl glass-card p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-serif text-xl font-bold text-foreground flex items-center gap-2">
                <Trophy className="w-5 h-5 text-gold" /> Achievements
              </h3>
              <span className="text-xs font-semibold text-gold flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> {earnedCount}/{ACHIEVEMENTS.length}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted mb-5 overflow-hidden">
              <div className="h-full gradient-gold transition-all duration-700" style={{ width: `${(earnedCount / Math.max(ACHIEVEMENTS.length, 1)) * 100}%` }} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {ACHIEVEMENTS.map((ach) => {
                const earned = stats.achievements.includes(ach.key);
                return (
                  <div
                    key={ach.key}
                    className={`text-center p-4 rounded-2xl border transition-all duration-300 ${earned ? "bg-gold/10 border-gold/30 glow-gold" : "bg-muted/30 border-border/50 opacity-60 grayscale"}`}
                  >
                    <span className="text-3xl block mb-2">{ach.icon}</span>
                    <p className="text-xs font-semibold text-foreground">{ach.label}</p>
                    <p className="text-[11px] text-foreground/80 mt-0.5 leading-snug">{ach.description}</p>
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
