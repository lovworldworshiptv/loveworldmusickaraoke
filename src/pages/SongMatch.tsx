import AppLayout from "@/components/layout/AppLayout";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen, Music2, FolderOpen, Play, Flame, Trophy, Target, Zap } from "lucide-react";
import { useGameStats } from "@/hooks/useGameStats";

const challenges = [
  {
    title: "Lyrics Game",
    description: "Match song lyrics to their titles. Learn the words that move hearts.",
    icon: BookOpen,
    color: "from-blue-500 to-indigo-600",
    path: "/games/songmatch/lyrics",
    statKey: "lyrics" as const,
  },
  {
    title: "Melody Game",
    description: "Identify songs by their melodies. Train your ear for worship.",
    icon: Music2,
    color: "from-pink-500 to-fuchsia-600",
    path: "/games/songmatch/melody",
    statKey: "melody" as const,
  },
  {
    title: "Category Game",
    description: "Match songs to their categories. Understand the purpose of each song.",
    icon: FolderOpen,
    color: "from-emerald-500 to-teal-600",
    path: "/games/songmatch/category",
    statKey: "category" as const,
  },
];

const steps = [
  { num: 1, title: "Choose Mode", desc: "Lyrics, Melody, or Category" },
  { num: 2, title: "Pick Difficulty", desc: "Easy, Medium, or Hard" },
  { num: 3, title: "Earn Points", desc: "Answer correctly & build streaks" },
];

const SongMatch = () => {
  const navigate = useNavigate();
  const { data: stats } = useGameStats();

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 lg:pt-6 pb-8 max-w-3xl mx-auto">
        <button
          onClick={() => navigate("/games")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Games Hub
        </button>

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg flex-shrink-0">
            <Music2 className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-serif font-bold text-foreground">SongMatch</h1>
            <p className="text-sm text-muted-foreground">
              Learn and recognize 400+ Loveworld praise and worship songs.
            </p>
          </div>
        </div>

        {/* Per-mode stats */}
        {stats && stats.totalGamesPlayed > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            {challenges.map((c) => {
              const games = stats[`${c.statKey}Games`];
              const points = stats[`${c.statKey}Points`];
              const bestStreak = stats[`${c.statKey}BestStreak`];
              return (
                <div key={c.statKey} className="glass-card p-3 text-center animate-fade-in">
                  <c.icon className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-xs font-semibold text-foreground">{c.title.split(" ")[0]}</p>
                  <div className="flex items-center justify-center gap-2 mt-1 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-0.5"><Target className="w-3 h-3" />{games}</span>
                    <span className="flex items-center gap-0.5"><Trophy className="w-3 h-3" />{points}</span>
                    <span className="flex items-center gap-0.5"><Zap className="w-3 h-3" />{bestStreak}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Challenge Cards */}
        <h2 className="text-lg font-semibold text-foreground mb-4">Choose Your Challenge</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {challenges.map((c, i) => (
            <button
              key={c.title}
              onClick={() => navigate(c.path)}
              className="glass-card p-5 text-left hover:ring-2 hover:ring-primary/50 transition-all duration-300 group animate-scale-in"
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center mb-3 shadow-md group-hover:scale-110 transition-transform duration-300`}>
                <c.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-bold text-foreground mb-1">{c.title}</h3>
              <p className="text-xs text-muted-foreground mb-4">{c.description}</p>
              <div className="flex items-center gap-2 text-sm font-medium text-primary group-hover:text-primary/80 transition-colors">
                <Play className="w-4 h-4" /> Play
              </div>
            </button>
          ))}
        </div>

        {/* How to Play */}
        <div className="glass-card p-6">
          <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
            <Flame className="w-5 h-5 text-amber-400" /> How to Play
          </h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            {steps.map((s) => (
              <div key={s.num}>
                <div className="w-9 h-9 rounded-full bg-amber-500/20 text-amber-400 font-bold text-sm flex items-center justify-center mx-auto mb-2">
                  {s.num}
                </div>
                <p className="font-semibold text-foreground text-sm">{s.title}</p>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default SongMatch;
