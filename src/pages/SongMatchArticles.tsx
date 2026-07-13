import { useState, useCallback, useRef, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Newspaper, Trophy, Star, Zap, RotateCcw, Home, CheckCircle, XCircle, FileText, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { saveGameSession, checkAndAwardAchievements, useGameStats } from "@/hooks/useGameStats";
import { useReferralGateGuard } from "@/hooks/useReferralGateGuard";

type Difficulty = "easy" | "medium" | "hard";
type ArticlesMode = "excerpt-to-title" | "excerpt-to-author" | "title-to-category";

interface ArticleQuestion {
  prompt: string;
  correctAnswer: string;
  options: string[];
  articleTitle: string;
  points: number;
}

interface AnswerRecord {
  question: ArticleQuestion;
  userAnswer: string;
  correct: boolean;
  timeTaken: number;
}

const DIFFICULTY_CONFIG = {
  easy: { label: "Easy", points: 10, snippet: 220, color: "bg-green-500", emoji: "🌱", speedThreshold: 10 },
  medium: { label: "Medium", points: 15, snippet: 120, color: "bg-amber-500", emoji: "🔥", speedThreshold: 8 },
  hard: { label: "Hard", points: 25, snippet: 60, color: "bg-red-500", emoji: "⚡", speedThreshold: 6 },
};

const MODES = [
  { key: "excerpt-to-title" as ArticlesMode, label: "Excerpt → Title", description: "Read a passage, pick the article title", icon: FileText },
  { key: "excerpt-to-author" as ArticlesMode, label: "Excerpt → Author", description: "Match the passage to its author", icon: User },
  { key: "title-to-category" as ArticlesMode, label: "Title → Category", description: "Pick the correct category for a title", icon: Newspaper },
];

const OPTION_COUNT = 4;
const QUESTIONS_PER_ROUND = 10;

function stripHtml(html: string) {
  return (html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function getSnippet(text: string, targetLen: number): string {
  const clean = stripHtml(text);
  if (clean.length <= targetLen) return clean;
  const start = Math.floor(Math.random() * Math.max(1, clean.length - targetLen));
  // trim to word boundary
  let s = clean.slice(start, start + targetLen);
  const firstSpace = s.indexOf(" ");
  const lastSpace = s.lastIndexOf(" ");
  if (firstSpace > 0) s = s.slice(firstSpace + 1);
  if (lastSpace > 0 && lastSpace < s.length) s = s.slice(0, lastSpace);
  return s + "…";
}

function pickOthers<T>(arr: T[], exclude: (t: T) => boolean, take: number, key: (t: T) => string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  for (const item of shuffled) {
    if (result.length >= take) break;
    if (exclude(item)) continue;
    const k = key(item);
    if (seen.has(k)) continue;
    seen.add(k);
    result.push(k);
  }
  return result;
}

interface Article {
  id: string;
  title: string;
  content: string;
  excerpt: string | null;
  author: string;
  category: string;
}

function buildQuestions(articles: Article[], mode: ArticlesMode, difficulty: Difficulty, count: number): ArticleQuestion[] {
  const cfg = DIFFICULTY_CONFIG[difficulty];
  const shuffled = [...articles].sort(() => Math.random() - 0.5);
  const questions: ArticleQuestion[] = [];
  const used = new Set<string>();

  for (const a of shuffled) {
    if (questions.length >= count) break;
    if (used.has(a.id)) continue;

    if (mode === "excerpt-to-title") {
      const source = a.content && stripHtml(a.content).length > 50 ? a.content : a.excerpt || "";
      const snippet = getSnippet(source, cfg.snippet);
      if (snippet.length < 30) continue;
      const others = pickOthers(shuffled, (o) => o.id === a.id || o.title === a.title, OPTION_COUNT - 1, (o) => o.title);
      if (others.length < OPTION_COUNT - 1) continue;
      used.add(a.id);
      questions.push({
        prompt: snippet, correctAnswer: a.title, articleTitle: a.title, points: cfg.points,
        options: [a.title, ...others].sort(() => Math.random() - 0.5),
      });
    } else if (mode === "excerpt-to-author") {
      const source = a.content && stripHtml(a.content).length > 50 ? a.content : a.excerpt || "";
      const snippet = getSnippet(source, cfg.snippet);
      if (snippet.length < 30 || !a.author) continue;
      const others = pickOthers(shuffled, (o) => !o.author || o.author === a.author, OPTION_COUNT - 1, (o) => o.author);
      if (others.length < OPTION_COUNT - 1) continue;
      used.add(a.id);
      questions.push({
        prompt: snippet, correctAnswer: a.author, articleTitle: a.title, points: cfg.points,
        options: [a.author, ...others].sort(() => Math.random() - 0.5),
      });
    } else {
      if (!a.category) continue;
      const others = pickOthers(shuffled, (o) => !o.category || o.category === a.category, OPTION_COUNT - 1, (o) => o.category);
      if (others.length < OPTION_COUNT - 1) continue;
      used.add(a.id);
      questions.push({
        prompt: a.title, correctAnswer: a.category, articleTitle: a.title, points: cfg.points,
        options: [a.category, ...others].sort(() => Math.random() - 0.5),
      });
    }
  }
  return questions;
}

const SongMatchArticles = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  useReferralGateGuard();
  const { data: gameStats } = useGameStats();
  const [mode, setMode] = useState<ArticlesMode | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [questions, setQuestions] = useState<ArticleQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [answered, setAnswered] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const { data: articles = [] } = useQuery({
    queryKey: ["songmatch-articles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("articles")
        .select("id, title, content, excerpt, author, category")
        .eq("is_published", true)
        .limit(2000);
      if (error) throw error;
      return (data || []) as Article[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const startGame = useCallback((diff: Difficulty) => {
    if (!mode) return;
    const q = buildQuestions(articles, mode, diff, QUESTIONS_PER_ROUND);
    setQuestions(q);
    setDifficulty(diff);
    setCurrentQ(0); setScore(0); setStreak(0); setBestStreak(0);
    setAnswered(null); setCompleted(false); setAnswers([]);
    setQuestionStartTime(Date.now());
  }, [articles, mode]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const handleAnswer = (option: string) => {
    if (answered) return;
    setAnswered(option);
    const timeTaken = (Date.now() - questionStartTime) / 1000;
    const correct = option === questions[currentQ].correctAnswer;
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
        setCurrentQ((q) => q + 1); setAnswered(null); setQuestionStartTime(Date.now());
      } else {
        setCompleted(true);
        if (user?.id && difficulty) {
          const correctCount = [...answers, { correct }].filter((a) => a.correct).length;
          const maxScore = questions.reduce((sum, q) => sum + q.points, 0);
          const finalScore = score + (correct ? pointsEarned : 0);
          const finalStreak = Math.max(bestStreak, correct ? streak + 1 : bestStreak);
          saveGameSession(user.id, "articles", difficulty, finalScore, maxScore, correctCount, questions.length, finalStreak);
          import("@/hooks/useChallenge").then(({ recordChallengeGame }) => recordChallengeGame("articles" as any, difficulty, finalScore));
          if (gameStats) {
            checkAndAwardAchievements(user.id, { ...gameStats, totalGamesPlayed: gameStats.totalGamesPlayed + 1, totalPoints: gameStats.totalPoints + finalScore });
          }
          queryClient.invalidateQueries({ queryKey: ["game-stats"] });
        }
      }
    }, 1200);
  };

  const modeLabel = MODES.find((m) => m.key === mode)?.label || "Articles Game";

  if (!mode) {
    return (
      <AppLayout>
        <div className="px-4 lg:px-6 pt-4 lg:pt-6 pb-8 max-w-md mx-auto">
          <button onClick={() => navigate("/games/songmatch")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 text-sm">
            <ArrowLeft className="w-4 h-4" /> Back to SongMatch
          </button>
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Newspaper className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-serif font-bold text-foreground mb-1">Articles Game</h1>
            <p className="text-muted-foreground text-sm">Test your knowledge of Loveworld articles</p>
          </div>
          <div className="space-y-3">
            {MODES.map((m) => {
              const Icon = m.icon;
              return (
                <button key={m.key} onClick={() => setMode(m.key)}
                  className="w-full glass-card p-4 flex items-center gap-4 hover:ring-2 hover:ring-primary/50 transition-all duration-300 text-left">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{m.label}</p>
                    <p className="text-muted-foreground text-xs">{m.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
          {articles.length < OPTION_COUNT && <p className="text-center text-xs text-muted-foreground mt-4">Not enough published articles available yet.</p>}
        </div>
      </AppLayout>
    );
  }

  if (!difficulty) {
    return (
      <AppLayout>
        <div className="px-4 lg:px-6 pt-4 lg:pt-6 pb-8 max-w-md mx-auto">
          <button onClick={() => setMode(null)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 text-sm">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Newspaper className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-serif font-bold text-foreground mb-1">{modeLabel}</h1>
            <p className="text-muted-foreground text-sm">Select Difficulty</p>
          </div>
          <div className="space-y-3">
            {(["easy", "medium", "hard"] as Difficulty[]).map((d) => {
              const cfg = DIFFICULTY_CONFIG[d];
              return (
                <button key={d} onClick={() => startGame(d)} disabled={articles.length < OPTION_COUNT}
                  className="w-full glass-card p-4 flex items-center justify-between hover:ring-2 hover:ring-primary/50 transition-all duration-300 disabled:opacity-50">
                  <span className="font-semibold text-foreground">{cfg.emoji} {cfg.label}</span>
                  <span className={`${cfg.color} text-white text-xs font-bold px-3 py-1 rounded-full`}>+{cfg.points} pts</span>
                </button>
              );
            })}
          </div>
        </div>
      </AppLayout>
    );
  }

  if (completed) {
    const maxScore = questions.reduce((sum, q) => sum + q.points, 0);
    const pct = maxScore ? Math.round((score / maxScore) * 100) : 0;
    const correctCount = answers.filter((a) => a.correct).length;
    return (
      <AppLayout>
        <div className="px-4 lg:px-6 pt-4 lg:pt-6 pb-8 max-w-md mx-auto">
          <div className="glass-card p-8 text-center mb-6">
            <Trophy className="w-16 h-16 text-amber-400 mx-auto mb-4" />
            <h2 className="text-2xl font-serif font-bold text-foreground mb-2">Game Complete!</h2>
            <p className="text-muted-foreground mb-4 text-sm capitalize">{modeLabel} · {difficulty} Mode</p>
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
            <h3 className="font-semibold text-foreground text-sm mb-3">📰 Learning Insights</h3>
            <div className="space-y-3">
              {answers.map((a, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  {a.correct ? <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />}
                  <div>
                    <p className="font-medium text-foreground">{a.question.articleTitle}</p>
                    <p className="text-muted-foreground">Answer: {a.question.correctAnswer}</p>
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
  if (!q) return (
    <AppLayout><div className="p-6 text-center text-sm text-muted-foreground">No questions could be built. Try another mode.</div></AppLayout>
  );

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 lg:pt-6 pb-8 max-w-lg mx-auto">
        <button onClick={() => { setDifficulty(null); }} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 text-sm">
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
        <div className="glass-card p-6 mb-6">
          <p className="text-xs text-muted-foreground mb-3 font-medium text-center">
            {mode === "title-to-category" ? "Which category does this article belong to?" : mode === "excerpt-to-author" ? "Who wrote this excerpt?" : "Which article is this excerpt from?"}
          </p>
          <p className={`text-foreground leading-relaxed ${mode === "title-to-category" ? "text-xl font-serif font-bold text-center" : "text-sm font-serif italic"}`}>
            {mode !== "title-to-category" && "“"}{q.prompt}{mode !== "title-to-category" && "”"}
          </p>
        </div>
        <div className="space-y-3">
          {q.options.map((opt, i) => {
            const letter = String.fromCharCode(65 + i);
            let cls = "w-full glass-card p-4 text-left text-sm font-medium transition-all duration-300 flex items-center gap-3 ";
            if (answered) {
              if (opt === q.correctAnswer) cls += "ring-2 ring-green-500 text-green-400";
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

export default SongMatchArticles;
