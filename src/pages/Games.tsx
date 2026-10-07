import AppLayout from "@/components/layout/AppLayout";
import { useNavigate } from "react-router-dom";
import { Trophy, Gamepad2, Star, Target, Share2, Sparkles, BookOpen, Music2, LayoutGrid, Crown, Sprout, Medal, Flame, Zap, Check, LockKeyhole } from "lucide-react";
import { useGameStats, ACHIEVEMENTS } from "@/hooks/useGameStats";
import ShareMenu, { buildShareUrl } from "@/components/share/ShareMenu";
import ChallengeBanner from "@/components/games/ChallengeBanner";
import GameHubCard from "@/components/games/GameHubCard";
import { Button } from "@/components/ui/button";
import { resolveGameCard, type GameCardKey, type GameCardSettings } from "@/lib/gameCards";
import { SETTING_KEYS, useSetting } from "@/lib/siteSettings";

const achievementPresentation = [
  { icon: BookOpen, tone: "game-tone-blue" },
  { icon: Music2, tone: "game-tone-purple" },
  { icon: LayoutGrid, tone: "game-tone-green" },
  { icon: Crown, tone: "game-tone-amber" },
  { icon: Sprout, tone: "game-tone-cyan" },
  { icon: Medal, tone: "game-tone-rose" },
  { icon: Flame, tone: "game-tone-blue" },
  { icon: Zap, tone: "game-tone-amber" },
];

const Games = () => {
  const navigate = useNavigate();
  const cardSettings = useSetting<GameCardSettings>(SETTING_KEYS.gameCards);
  const { data: stats } = useGameStats();
  const earnedCount = stats?.achievements.length || 0;

  const games = [
    {
      key: "songmatch", path: "/games/songmatch", tag: "Music quiz",
      played: stats?.totalGamesPlayed ?? 0, points: stats?.totalPoints ?? 0,
      shareTitle: "Song Master Challenge", shareText: "I challenge you to play SongMatch! Test your music knowledge on Loveworld Music Karaoke+",
    },
    {
      key: "articles", path: "/games/songmatch/articles", tag: "Knowledge quiz",
      played: (stats as any)?.articlesGames ?? 0, points: (stats as any)?.articlesPoints ?? 0,
      shareTitle: "Articles Game", shareText: "I challenge you to the Articles Game on Loveworld Music Karaoke+",
    },
  ];

  return (
    <AppLayout>
      <div className="games-interactive px-4 lg:px-6 pt-6 lg:pt-10 pb-10 max-w-4xl mx-auto">
        <ChallengeBanner />

        {/* Header */}
        <div className="game-hub-intro relative overflow-hidden rounded-3xl glass-card p-6 lg:p-8 mb-6">
          <div className="relative flex items-start gap-4">
            <div className="h-14 w-14 shrink-0 rounded-2xl gradient-gold flex items-center justify-center shadow-lg glow-gold game-icon-float">
              <Gamepad2 aria-hidden="true" className="h-8 w-8 text-primary-foreground game-controller" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">Play & Grow</p>
              <h1 className="text-3xl lg:text-4xl font-serif font-bold text-foreground leading-tight">Games Hub</h1>
              <p className="text-sm text-foreground/90 mt-1">Learn. Play. Grow. Test your music knowledge!</p>
            </div>
          </div>

          {stats && stats.totalGamesPlayed > 0 && (
            <div className="relative grid grid-cols-3 gap-3 mt-6">
              {[
                { icon: Gamepad2, value: stats.totalGamesPlayed, label: "Games", tone: "game-tone-blue" },
                { icon: Star, value: stats.totalPoints, label: "Points", tone: "game-tone-green" },
                { icon: Trophy, value: earnedCount, label: "Badges", tone: "game-tone-amber" },
              ].map(({ icon: Icon, value, label, tone }) => (
                <div key={label} className={`rounded-2xl game-achievement-card ${tone} min-w-0 p-2 sm:p-3 text-center`}>
                  <Icon aria-hidden="true" className="w-4 h-4 game-achievement-icon game-icon-pulse mx-auto mb-1" />
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
          <div className="py-2 animate-fade-in">
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
              {ACHIEVEMENTS.map((ach, index) => {
                const earned = stats.achievements.includes(ach.key);
                const presentation = achievementPresentation[index] ?? achievementPresentation[0];
                const Icon = presentation.icon;
                return (
                  <div
                    key={ach.key}
                    aria-label={`${ach.label}: ${earned ? "Earned" : "Not yet earned"}`}
                    className={`relative text-center p-4 pt-6 min-w-0 rounded-2xl game-achievement-card ${presentation.tone}`}
                  >
                    {earned ? <Check aria-label="Earned" className="absolute right-2 top-2 h-3.5 w-3.5 text-foreground" /> : <LockKeyhole aria-label="Not yet earned" className="absolute right-2 top-2 h-3.5 w-3.5 text-foreground/80" />}
                    <Icon aria-hidden="true" strokeWidth={1.8} className="w-10 h-10 mx-auto mb-3 game-achievement-icon game-icon-float" />
                    <p className="text-xs font-semibold text-foreground">{ach.label}</p>
                    <p className="text-[11px] text-foreground mt-1 leading-snug">{ach.description}</p>
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
