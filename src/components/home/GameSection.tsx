import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Lock, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface GameLevel {
  id: string;
  level: number;
  title: string;
  image_url: string | null;
  is_active: boolean;
  questionCount: number;
  completed: boolean;
}

const GameSection = () => {
  const [levels, setLevels] = useState<GameLevel[]>([]);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const fetchLevels = async () => {
      const { data: levelData } = await supabase
        .from("game_levels")
        .select("*")
        .order("level");

      if (!levelData || levelData.length === 0) return;

      // Get question counts per level
      const levelIds = levelData.map(l => l.id);
      const { data: questions } = await supabase
        .from("quiz_questions")
        .select("level_id")
        .in("level_id", levelIds);

      const countMap: Record<string, number> = {};
      (questions || []).forEach(q => {
        countMap[q.level_id] = (countMap[q.level_id] || 0) + 1;
      });

      // Get user progress if logged in
      let progressMap: Record<string, boolean> = {};
      if (user) {
        const { data: progress } = await supabase
          .from("user_game_progress")
          .select("level_id, completed")
          .eq("user_id", user.id)
          .eq("completed", true);
        (progress || []).forEach(p => { progressMap[p.level_id] = true; });
      }

      setLevels(levelData.map(l => ({
        id: l.id,
        level: l.level,
        title: l.title,
        image_url: l.image_url,
        is_active: l.is_active,
        questionCount: countMap[l.id] || 0,
        completed: !!progressMap[l.id],
      })));
    };
    fetchLevels();
  }, [user]);

  if (levels.length === 0) return null;

  return (
    <section className="px-4 lg:px-6 mt-8 animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-serif font-bold text-foreground">Loveworld Music Games</h3>
        <button onClick={() => navigate("/games")} className="text-xs text-gold hover:text-gold-light font-medium transition-colors duration-200">Play Now</button>
      </div>
      <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
        {levels.map((level, i) => {
          const locked = !level.is_active;
          return (
            <button
              key={level.id}
              onClick={() => { if (!locked) navigate("/games"); }}
              disabled={locked}
              className={`flex-shrink-0 w-40 glass-card p-4 text-center transition-all duration-300 animate-fade-in-up ${
                locked
                  ? "opacity-40 cursor-not-allowed"
                  : "hover:glow-gold hover:-translate-y-1 cursor-pointer"
              }`}
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div className={`w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center gradient-purple border-2 transition-all duration-300 overflow-hidden ${
                level.completed ? "border-gold" : locked ? "border-border" : "border-border hover:border-gold"
              }`}>
                {level.image_url ? (
                  <img src={level.image_url} alt={level.title} className="w-full h-full object-cover" />
                ) : level.completed ? (
                  <CheckCircle2 className="w-7 h-7 text-gold" />
                ) : locked ? (
                  <Lock className="w-6 h-6 text-muted-foreground" />
                ) : (
                  <Trophy className="w-6 h-6 text-gold" />
                )}
              </div>
              <p className="text-xs font-semibold text-foreground mb-1">Level {level.level}</p>
              <p className="text-[10px] text-muted-foreground">{level.title}</p>
              <p className="text-[10px] text-gold mt-2">{level.questionCount} Quizzes</p>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default GameSection;
