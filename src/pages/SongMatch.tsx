import AppLayout from "@/components/layout/AppLayout";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen, Music2, FolderOpen, Play, Flame } from "lucide-react";

const challenges = [
  {
    title: "Lyrics Game",
    description: "Match song lyrics to their titles",
    icon: BookOpen,
    color: "from-blue-500 to-indigo-600",
    path: "/games/songmatch/lyrics",
  },
  {
    title: "Melody Game",
    description: "Identify songs by their melodies",
    icon: Music2,
    color: "from-pink-500 to-fuchsia-600",
    path: "/games/songmatch/melody",
  },
  {
    title: "Category Game",
    description: "Match songs to their categories",
    icon: FolderOpen,
    color: "from-emerald-500 to-teal-600",
    path: "/games/songmatch/category",
  },
];

const steps = [
  { num: 1, title: "Choose Mode", desc: "Lyrics, Melody, or Category" },
  { num: 2, title: "Pick Difficulty", desc: "Easy, Medium, or Hard" },
  { num: 3, title: "Earn Points", desc: "Answer correctly & build streaks" },
];

const SongMatch = () => {
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 lg:pt-6 pb-8 max-w-3xl mx-auto">
        {/* Back button */}
        <button
          onClick={() => navigate("/games")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Games Hub
        </button>

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg flex-shrink-0">
            <Music2 className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-serif font-bold text-foreground">SongMatch</h1>
            <p className="text-sm text-muted-foreground">
              Test your knowledge of Loveworld praise and worship songs through lyrics, melodies, and categories.
            </p>
          </div>
        </div>

        {/* Choose Your Challenge */}
        <h2 className="text-lg font-semibold text-foreground mb-4">Choose Your Challenge</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {challenges.map((c) => (
            <button
              key={c.title}
              onClick={() => navigate(c.path)}
              className="glass-card p-5 text-left hover:ring-2 hover:ring-primary/50 transition-all duration-300 group"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center mb-3 shadow-md`}>
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
