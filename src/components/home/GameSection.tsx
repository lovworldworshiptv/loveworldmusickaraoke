import { gameLevels } from "@/data/mockData";
import { Trophy, Lock, CheckCircle2 } from "lucide-react";

const GameSection = () => {
  return (
    <section className="px-4 lg:px-6 mt-8 animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-serif font-bold text-foreground">Loveworld Music Games</h3>
        <button className="text-xs text-gold hover:text-gold-light font-medium transition-colors duration-200">Play Now</button>
      </div>
      <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
        {gameLevels.map((level, i) => (
          <div
            key={level.id}
            className={`flex-shrink-0 w-40 glass-card p-4 text-center transition-all duration-300 animate-fade-in-up ${
              level.locked
                ? "opacity-40"
                : "hover:glow-gold hover:-translate-y-1 cursor-pointer"
            }`}
            style={{ animationDelay: `${i * 0.08}s` }}
          >
            <div className={`w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center gradient-purple border-2 transition-all duration-300 ${
              level.completed ? "border-gold" : level.locked ? "border-border" : "border-border hover:border-gold"
            }`}>
              {level.completed ? (
                <CheckCircle2 className="w-7 h-7 text-gold" />
              ) : level.locked ? (
                <Lock className="w-6 h-6 text-muted-foreground" />
              ) : (
                <Trophy className="w-6 h-6 text-gold" />
              )}
            </div>
            <p className="text-xs font-semibold text-foreground mb-1">Level {level.level}</p>
            <p className="text-[10px] text-muted-foreground">{level.title}</p>
            <p className="text-[10px] text-gold mt-2">{level.quizCount} Quizzes</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default GameSection;
