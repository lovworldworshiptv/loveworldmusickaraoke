import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Trophy, Lock, CheckCircle2, ArrowLeft, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface GameLevel {
  id: string;
  level: number;
  title: string;
}

interface QuizQuestion {
  id: string;
  song_title: string;
  lyric_text: string;
  missing_word: string;
  options: string[];
  sort_order: number;
}

const Games = () => {
  const [levels, setLevels] = useState<GameLevel[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<GameLevel | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [completedLevels, setCompletedLevels] = useState<Set<number>>(new Set());

  useEffect(() => {
    supabase.from("game_levels").select("*").order("level").then(({ data }) => {
      if (data) setLevels(data);
    });
  }, []);

  const startLevel = async (level: GameLevel) => {
    const { data } = await supabase
      .from("quiz_questions")
      .select("*")
      .eq("level_id", level.id)
      .order("sort_order");
    if (data) {
      setQuestions(data);
      setSelectedLevel(level);
      setCurrentQ(0);
      setScore(0);
      setAnswered(null);
      setCompleted(false);
    }
  };

  const handleAnswer = (option: string) => {
    if (answered) return;
    setAnswered(option);
    if (option === questions[currentQ].missing_word) {
      setScore((s) => s + 1);
    }
    setTimeout(() => {
      if (currentQ + 1 < questions.length) {
        setCurrentQ((q) => q + 1);
        setAnswered(null);
      } else {
        setCompleted(true);
        setCompletedLevels((prev) => new Set([...prev, selectedLevel!.level]));
      }
    }, 1200);
  };

  const isLevelUnlocked = (level: number) => {
    if (level === 1) return true;
    return completedLevels.has(level - 1);
  };

  if (selectedLevel && !completed) {
    const q = questions[currentQ];
    if (!q) return null;
    return (
      <AppLayout>
        <div className="px-4 lg:px-6 pt-4 lg:pt-6 max-w-lg mx-auto">
          <button onClick={() => setSelectedLevel(null)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="w-4 h-4" /> Back to Levels
          </button>

          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-serif font-bold text-foreground">Level {selectedLevel.level}</h3>
            <span className="text-sm text-gold font-medium">{currentQ + 1}/{questions.length}</span>
          </div>

          {/* Progress */}
          <div className="w-full h-2 rounded-full bg-muted mb-6">
            <div className="h-full rounded-full gradient-gold transition-all duration-500" style={{ width: `${((currentQ + 1) / questions.length) * 100}%` }} />
          </div>

          {/* Question */}
          <div className="glass-card p-6 mb-6">
            <p className="text-xs text-gold mb-2 font-medium">{q.song_title}</p>
            <p className="text-lg font-serif text-foreground leading-relaxed">
              {q.lyric_text.replace("___", "______")}
            </p>
          </div>

          {/* Options */}
          <div className="grid grid-cols-2 gap-3">
            {q.options.map((opt) => {
              let cls = "glass-card p-4 text-center text-sm font-medium transition-all duration-300 ";
              if (answered) {
                if (opt === q.missing_word) cls += "ring-2 ring-green-500 text-green-400";
                else if (opt === answered) cls += "ring-2 ring-destructive text-destructive";
                else cls += "text-muted-foreground opacity-50";
              } else {
                cls += "text-foreground hover:ring-2 hover:ring-primary cursor-pointer";
              }
              return (
                <button key={opt} onClick={() => handleAnswer(opt)} className={cls} disabled={!!answered}>
                  {opt}
                </button>
              );
            })}
          </div>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            Score: <span className="text-gold font-bold">{score}</span>
          </div>
        </div>
        <div className="h-8" />
      </AppLayout>
    );
  }

  if (completed && selectedLevel) {
    const percentage = Math.round((score / questions.length) * 100);
    return (
      <AppLayout>
        <div className="px-4 lg:px-6 pt-4 lg:pt-6 max-w-md mx-auto text-center">
          <div className="glass-card p-8">
            <Trophy className="w-16 h-16 text-gold mx-auto mb-4" />
            <h2 className="text-2xl font-serif font-bold gradient-gold-text mb-2">Level Complete!</h2>
            <p className="text-muted-foreground mb-4">{selectedLevel.title}</p>
            <div className="flex justify-center gap-1 mb-4">
              {[1, 2, 3].map((star) => (
                <Star key={star} className={`w-8 h-8 ${percentage >= star * 30 ? "text-gold fill-gold" : "text-muted-foreground"}`} />
              ))}
            </div>
            <p className="text-3xl font-bold text-gold mb-1">{score}/{questions.length}</p>
            <p className="text-sm text-muted-foreground mb-6">{percentage}% correct</p>
            <div className="flex gap-3">
              <button onClick={() => startLevel(selectedLevel)} className="flex-1 py-3 rounded-lg border border-border text-foreground hover:bg-muted transition-colors">
                Retry
              </button>
              <button onClick={() => setSelectedLevel(null)} className="flex-1 py-3 rounded-lg gradient-gold text-primary-foreground hover:opacity-90 transition-opacity">
                Continue
              </button>
            </div>
          </div>
        </div>
        <div className="h-8" />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 lg:pt-6">
        <h2 className="text-2xl font-serif font-bold text-foreground mb-2">Loveworld Music Games</h2>
        <p className="text-sm text-muted-foreground mb-6">Complete the lyrics challenge!</p>

        <div className="space-y-4">
          {levels.map((level) => {
            const unlocked = isLevelUnlocked(level.level);
            const done = completedLevels.has(level.level);
            return (
              <button key={level.id} disabled={!unlocked}
                onClick={() => startLevel(level)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all duration-300 ${
                  unlocked ? "glass-card hover:glow-gold cursor-pointer" : "glass-card opacity-50"
                }`}>
                <div className="w-14 h-14 rounded-full flex items-center justify-center gradient-purple border-2 border-border flex-shrink-0">
                  {done ? <CheckCircle2 className="w-7 h-7 text-gold" /> :
                    !unlocked ? <Lock className="w-6 h-6 text-muted-foreground" /> :
                    <Trophy className="w-6 h-6 text-gold" />}
                </div>
                <div className="text-left flex-1">
                  <p className="font-semibold text-foreground">Level {level.level}</p>
                  <p className="text-xs text-muted-foreground">{level.title}</p>
                </div>
                <span className="text-xs text-gold">10 Quizzes</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="h-8" />
    </AppLayout>
  );
};

export default Games;
