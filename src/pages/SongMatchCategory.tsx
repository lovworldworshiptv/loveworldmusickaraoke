import { useState, useCallback, useRef, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, FolderOpen, Trophy, Star, Zap, RotateCcw, Home, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { saveGameSession, checkAndAwardAchievements, useGameStats } from "@/hooks/useGameStats";
import { useReferralGateGuard } from "@/hooks/useReferralGateGuard";

type Difficulty = "easy" | "medium" | "hard";

interface CategoryQuestion {
  songTitle: string;
  artist: string;
  correctCategory: string;
  options: string[];
  points: number;
}

interface AnswerRecord {
  question: CategoryQuestion;
  userAnswer: string;
  correct: boolean;
  timeTaken: number;
}

const DIFFICULTY_CONFIG = {
  easy: { label: "Easy", points: 10, color: "bg-green-500", emoji: "🌱", speedThreshold: 8 },
  medium: { label: "Medium", points: 15, color: "bg-amber-500", emoji: "🔥", speedThreshold: 6 },
  hard: { label: "Hard", points: 25, color: "bg-red-500", emoji: "⚡", speedThreshold: 4 },
};

const OPTION_COUNT = 4;
const QUESTIONS_PER_ROUND = 10;

function generateCategoryQuestions(
  songs: { title: string; artist: string; category_name: string }[],
  allCategories: string[],
  difficulty: Difficulty,
  count: number
): CategoryQuestion[] {
  const config = DIFFICULTY_CONFIG[difficulty];
  const shuffled = [...songs].sort(() => Math.random() - 0.5);
  const questions: CategoryQuestion[] = [];
  const usedSongs = new Set<string>();

  for (const song of shuffled) {
    if (questions.length >= count) break;
    if (usedSongs.has(song.title)) continue;

    const otherCategories = allCategories
      .filter((c) => c !== song.category_name)
      .sort(() => Math.random() - 0.5)
      .slice(0, OPTION_COUNT - 1);

    if (otherCategories.length < OPTION_COUNT - 1) continue;

    const options = [song.category_name, ...otherCategories].sort(() => Math.random() - 0.5);
    usedSongs.add(song.title);
    questions.push({ songTitle: song.title, artist: song.artist, correctCategory: song.category_name, options, points: config.points });
  }

  return questions.sort(() => Math.random() - 0.5);
}

const SongMatchCategory = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  useReferralGateGuard();
  const { data: gameStats } = useGameStats();
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [questions, setQuestions] = useState<CategoryQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [answered, setAnswered] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const { data: songsWithCategories = [] } = useQuery({
    queryKey: ["songmatch-category-songs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("songs")
        .select("title, artist, category_id, categories(name)")
        .not("category_id", "is", null)
        .limit(5000);
      if (error) throw error;
      return (data || [])
        .filter((s: any) => s.categories?.name)
        .map((s: any) => ({ title: s.title, artist: s.artist, category_name: s.categories.name }));
    },
    staleTime: 5 * 60 * 1000,
  });

  const allCategories = [...new Set(songsWithCategories.map((s) => s.category_name))];

  const startGame = useCallback(
    (diff: Difficulty) => {
      const q = generateCategoryQuestions(songsWithCategories, allCategories, diff, QUESTIONS_PER_ROUND);
      setQuestions(q);
      setDifficulty(diff);
      setCurrentQ(0);
      setScore(0);
      setStreak(0);
      setBestStreak(0);
      setAnswered(null);
      setCompleted(false);
      setAnswers([]);
      setQuestionStartTime(Date.now());
    },
    [songsWithCategories, allCategories]
  );

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const handleAnswer = (option: string) => {
    if (answered) return;
    setAnswered(option);
    const timeTaken = (Date.now() - questionStartTime) / 1000;
    const correct = option === questions[currentQ].correctCategory;
    let pointsEarned = 0;

    if (correct) {
      const streakBonus = Math.floor(streak / 3) * 5;
      const speedBonus = difficulty && timeTaken < DIFFICULTY_CONFIG[difficulty].speedThreshold ? 5 : 0;
      pointsEarned = questions[currentQ].points + streakBonus + speedBonus;
      setScore((s) => s + pointsEarned);
      setStreak((s) => { const n = s + 1; setBestStreak((b) => Math.max(b, n)); return n; });
    } else {
      setStreak(0);
    }

    setAnswers((prev) => [...prev, { question: questions[currentQ], userAnswer: option, correct, timeTaken }]);

    timerRef.current = setTimeout(() => {
      if (currentQ + 1 < questions.length) {
        setCurrentQ((q) => q + 1);
        setAnswered(null);
        setQuestionStartTime(Date.now());
      } else {
        setCompleted(true);
        if (user?.id && difficulty) {
          const correctCount = [...answers, { correct }].filter((a) => a.correct).length;
          const maxScore = questions.reduce((sum, q) => sum + q.points, 0);
          const finalScore = score + (correct ? pointsEarned : 0);
          const finalStreak = Math.max(bestStreak, correct ? streak + 1 : bestStreak);
          saveGameSession(user.id, "category", difficulty, finalScore, maxScore, correctCount, questions.length, finalStreak);
          import("@/hooks/useChallenge").then(({ recordChallengeGame }) => recordChallengeGame("category", difficulty, finalScore));
          if (gameStats) {
            checkAndAwardAchievements(user.id, { ...gameStats, totalGamesPlayed: gameStats.totalGamesPlayed + 1, totalPoints: gameStats.totalPoints + finalScore, categoryGames: gameStats.categoryGames + 1, categoryPoints: gameStats.categoryPoints + finalScore, categoryBestStreak: Math.max(gameStats.categoryBestStreak, finalStreak) });
          }
          queryClient.invalidateQueries({ queryKey: ["game-stats"] });
        }
      }
    }, 1200);
  };

  if (!difficulty) {
    return (
      <AppLayout>
        <div className="px-4 lg:px-6 pt-4 lg:pt-6 pb-8 max-w-md mx-auto">
          <button onClick={() => navigate("/games/songmatch")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 text-sm">
            <ArrowLeft className="w-4 h-4" /> Back to SongMatch
          </button>
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
              <FolderOpen className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-serif font-bold text-foreground mb-1">Category Game</h1>
            <p className="text-muted-foreground text-sm">Match songs to their categories</p>
          </div>
          <p className="text-center text-sm text-muted-foreground mb-4">Select Difficulty</p>
          <div className="space-y-3">
            {(["easy", "medium", "hard"] as Difficulty[]).map((d) => {
              const config = DIFFICULTY_CONFIG[d];
              return (
                <button key={d} onClick={() => startGame(d)} disabled={allCategories.length < OPTION_COUNT}
                  className="w-full glass-card p-4 flex items-center justify-between hover:ring-2 hover:ring-primary/50 transition-all duration-300 disabled:opacity-50">
                  <span className="font-semibold text-foreground">{config.emoji} {config.label}</span>
                  <span className={`${config.color} text-white text-xs font-bold px-3 py-1 rounded-full`}>+{config.points} pts</span>
                </button>
              );
            })}
          </div>
          {allCategories.length < OPTION_COUNT && <p className="text-center text-xs text-muted-foreground mt-4">Not enough song categories available (need at least {OPTION_COUNT})</p>}
        </div>
      </AppLayout>
    );
  }

  if (completed) {
    const maxScore = questions.reduce((sum, q) => sum + q.points, 0);
    const pct = Math.round((score / maxScore) * 100);
    const correctCount = answers.filter((a) => a.correct).length;
    return (
      <AppLayout>
        <div className="px-4 lg:px-6 pt-4 lg:pt-6 pb-8 max-w-md mx-auto">
          <div className="glass-card p-8 text-center mb-6">
            <Trophy className="w-16 h-16 text-amber-400 mx-auto mb-4" />
            <h2 className="text-2xl font-serif font-bold text-foreground mb-2">Game Complete!</h2>
            <p className="text-muted-foreground mb-4 text-sm capitalize">{difficulty} Mode</p>
            <div className="flex justify-center gap-1 mb-4">
              {[1, 2, 3].map((star) => (
                <Star key={star} className={`w-8 h-8 ${pct >= star * 30 ? "text-amber-400 fill-amber-400" : "text-muted-foreground"}`} />
              ))}
            </div>
            <p className="text-4xl font-bold text-amber-400 mb-1">{score}</p>
            <p className="text-sm text-muted-foreground mb-2">points earned</p>
            <div className="flex justify-center gap-4 text-xs text-muted-foreground mb-6">
              <span>{correctCount}/{questions.length} correct</span>
              <span>Best streak: {bestStreak}</span>
            </div>
            <div className="flex gap-3">
              <button onClick={() => startGame(difficulty)} className="flex-1 py-3 rounded-lg border border-border text-foreground hover:bg-muted transition-colors flex items-center justify-center gap-2 text-sm">
                <RotateCcw className="w-4 h-4" /> Retry
              </button>
              <button onClick={() => navigate("/games/songmatch")} className="flex-1 py-3 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity flex items-center justify-center gap-2 text-sm">
                <Home className="w-4 h-4" /> Menu
              </button>
            </div>
          </div>
          <div className="glass-card p-5">
            <h3 className="font-semibold text-foreground text-sm mb-3">📂 Learning Insights</h3>
            <div className="space-y-3">
              {answers.map((a, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  {a.correct ? <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />}
                  <div>
                    <p className="font-medium text-foreground">{a.question.songTitle}</p>
                    <p className="text-muted-foreground">Category: {a.question.correctCategory}</p>
                    {!a.correct && <p className="text-destructive">You answered: {a.userAnswer}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  const q = questions[currentQ];
  if (!q) return null;

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 lg:pt-6 pb-8 max-w-lg mx-auto">
        <button onClick={() => setDifficulty(null)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 text-sm">
          <ArrowLeft className="w-4 h-4" /> Quit
        </button>
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-muted-foreground">Question {currentQ + 1}/{questions.length}</span>
          <div className="flex items-center gap-3">
            {streak >= 3 && <span className="flex items-center gap-1 text-xs text-amber-400 font-medium"><Zap className="w-3 h-3" /> {streak}x streak</span>}
            <span className="text-sm font-bold text-amber-400">{score} pts</span>
          </div>
        </div>
        <div className="w-full h-2 rounded-full bg-muted mb-6">
          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${((currentQ + 1) / questions.length) * 100}%` }} />
        </div>
        <div className="glass-card p-6 mb-6 text-center">
          <p className="text-xs text-foreground mb-3 font-medium">What category does this song belong to?</p>
          <p className="text-xl font-serif font-bold text-foreground mb-1">{q.songTitle}</p>
          <p className="text-sm text-foreground">{q.artist}</p>
        </div>
        <div className="space-y-3">
          {q.options.map((opt, i) => {
            const letter = String.fromCharCode(65 + i);
            let cls = "w-full glass-card p-4 text-left text-sm font-medium transition-all duration-300 flex items-center gap-3 ";
            if (answered) {
              if (opt === q.correctCategory) cls += "ring-2 ring-green-500 text-green-400";
              else if (opt === answered) cls += "ring-2 ring-destructive text-destructive";
              else cls += "text-muted-foreground opacity-50";
            } else {
              cls += "text-foreground hover:ring-2 hover:ring-primary cursor-pointer";
            }
            return (
              <button key={opt} onClick={() => handleAnswer(opt)} className={cls} disabled={!!answered}>
                <span className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold flex-shrink-0">{letter}</span>
                {opt}
              </button>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
};

export default SongMatchCategory;
