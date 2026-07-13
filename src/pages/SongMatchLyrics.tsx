import { useState, useCallback, useRef, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen, Trophy, Star, Zap, RotateCcw, Home, CheckCircle, XCircle, FileText, Music, PenTool } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { saveGameSession, checkAndAwardAchievements, useGameStats } from "@/hooks/useGameStats";

type Difficulty = "easy" | "medium" | "hard";
type LyricsMode = "lyrics-to-title" | "title-to-lyrics" | "fill-in-blank";

interface LyricsQuestion {
  prompt: string;
  correctAnswer: string;
  options: string[];
  songTitle: string;
  artist: string;
  lyricSnippet: string;
  points: number;
}

interface AnswerRecord {
  question: LyricsQuestion;
  userAnswer: string;
  correct: boolean;
  timeTaken: number;
}

const DIFFICULTY_CONFIG = {
  easy: { label: "Easy", points: 10, lineCount: 6, color: "bg-green-500", emoji: "🌱", speedThreshold: 8 },
  medium: { label: "Medium", points: 15, lineCount: 3, color: "bg-amber-500", emoji: "🔥", speedThreshold: 6 },
  hard: { label: "Hard", points: 25, lineCount: 1, color: "bg-red-500", emoji: "⚡", speedThreshold: 4 },
};

const LYRICS_MODES = [
  { key: "lyrics-to-title" as LyricsMode, label: "Lyrics → Title", description: "Read lyrics, guess the song title", icon: FileText },
  { key: "title-to-lyrics" as LyricsMode, label: "Title → Lyrics", description: "See the title, pick the correct lyrics", icon: Music },
  { key: "fill-in-blank" as LyricsMode, label: "Fill in the Blank", description: "Complete the missing word in the lyric", icon: PenTool },
];

const OPTION_COUNT = 4;
const QUESTIONS_PER_ROUND = 10;

function parseLrcLines(lrc: string): string[] {
  return lrc
    .split("\n")
    .map((line) => line.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, "").trim())
    .filter((line) => line.length > 3 && !/^[♪♫]+$/.test(line));
}

function getSnippet(lines: string[], lineCount: number): string {
  const startIdx = Math.floor(Math.random() * Math.max(1, lines.length - lineCount));
  return lines.slice(startIdx, startIdx + lineCount).join("\n");
}

function generateLyricsToTitleQuestions(
  songs: { title: string; artist: string; lyrics_lrc: string }[],
  difficulty: Difficulty,
  count: number
): LyricsQuestion[] {
  const config = DIFFICULTY_CONFIG[difficulty];
  const shuffled = [...songs].sort(() => Math.random() - 0.5);
  const questions: LyricsQuestion[] = [];
  const used = new Set<string>();

  for (const song of shuffled) {
    if (questions.length >= count || used.has(song.title)) continue;
    const lines = parseLrcLines(song.lyrics_lrc);
    if (lines.length < config.lineCount) continue;

    const snippet = getSnippet(lines, config.lineCount);
    const others = shuffled.filter((s) => s.title !== song.title).sort(() => Math.random() - 0.5).slice(0, OPTION_COUNT - 1).map((s) => s.title);
    if (others.length < OPTION_COUNT - 1) continue;

    used.add(song.title);
    questions.push({
      prompt: snippet,
      correctAnswer: song.title,
      options: [song.title, ...others].sort(() => Math.random() - 0.5),
      songTitle: song.title,
      artist: song.artist,
      lyricSnippet: snippet,
      points: config.points,
    });
  }
  return questions.sort(() => Math.random() - 0.5);
}

function generateTitleToLyricsQuestions(
  songs: { title: string; artist: string; lyrics_lrc: string }[],
  difficulty: Difficulty,
  count: number
): LyricsQuestion[] {
  const config = DIFFICULTY_CONFIG[difficulty];
  const shuffled = [...songs].sort(() => Math.random() - 0.5);
  const questions: LyricsQuestion[] = [];
  const used = new Set<string>();

  for (const song of shuffled) {
    if (questions.length >= count || used.has(song.title)) continue;
    const lines = parseLrcLines(song.lyrics_lrc);
    if (lines.length < config.lineCount) continue;

    const snippet = getSnippet(lines, config.lineCount);

    // Get lyric snippets from other songs as wrong options
    const otherSnippets: string[] = [];
    for (const other of shuffled) {
      if (other.title === song.title || otherSnippets.length >= OPTION_COUNT - 1) continue;
      const oLines = parseLrcLines(other.lyrics_lrc);
      if (oLines.length < config.lineCount) continue;
      otherSnippets.push(getSnippet(oLines, config.lineCount));
    }
    if (otherSnippets.length < OPTION_COUNT - 1) continue;

    used.add(song.title);
    questions.push({
      prompt: song.title,
      correctAnswer: snippet,
      options: [snippet, ...otherSnippets].sort(() => Math.random() - 0.5),
      songTitle: song.title,
      artist: song.artist,
      lyricSnippet: snippet,
      points: config.points,
    });
  }
  return questions.sort(() => Math.random() - 0.5);
}

function generateFillInBlankQuestions(
  songs: { title: string; artist: string; lyrics_lrc: string }[],
  difficulty: Difficulty,
  count: number
): LyricsQuestion[] {
  const config = DIFFICULTY_CONFIG[difficulty];
  const shuffled = [...songs].sort(() => Math.random() - 0.5);
  const questions: LyricsQuestion[] = [];
  const used = new Set<string>();

  for (const song of shuffled) {
    if (questions.length >= count || used.has(song.title)) continue;
    const lines = parseLrcLines(song.lyrics_lrc);
    if (lines.length < 2) continue;

    // Pick a random line with enough words
    const candidates = lines.filter((l) => l.split(/\s+/).length >= 4);
    if (candidates.length === 0) continue;

    const line = candidates[Math.floor(Math.random() * candidates.length)];
    const words = line.split(/\s+/);
    // Pick a word to blank out (not first/last for better context), prefer longer words
    const blankCandidates = words
      .map((w, i) => ({ w, i }))
      .filter(({ w, i }) => i > 0 && i < words.length - 1 && w.length >= 3);
    if (blankCandidates.length === 0) continue;

    const { w: blankWord, i: blankIdx } = blankCandidates[Math.floor(Math.random() * blankCandidates.length)];
    const cleanBlank = blankWord.replace(/[^a-zA-Z'-]/g, "");
    if (cleanBlank.length < 3) continue;

    const displayLine = words.map((w, i) => (i === blankIdx ? "_____" : w)).join(" ");

    // Generate wrong word options from other songs
    const wrongWords = new Set<string>();
    for (const other of shuffled) {
      if (wrongWords.size >= OPTION_COUNT - 1) break;
      if (other.title === song.title) continue;
      const oLines = parseLrcLines(other.lyrics_lrc);
      for (const ol of oLines) {
        if (wrongWords.size >= OPTION_COUNT - 1) break;
        const oWords = ol.split(/\s+/).filter((w) => w.length >= 3).map((w) => w.replace(/[^a-zA-Z'-]/g, ""));
        for (const ow of oWords) {
          if (ow.length >= 3 && ow.toLowerCase() !== cleanBlank.toLowerCase() && !wrongWords.has(ow)) {
            wrongWords.add(ow);
            break;
          }
        }
      }
    }
    if (wrongWords.size < OPTION_COUNT - 1) continue;

    used.add(song.title);
    questions.push({
      prompt: displayLine,
      correctAnswer: cleanBlank,
      options: [cleanBlank, ...Array.from(wrongWords).slice(0, OPTION_COUNT - 1)].sort(() => Math.random() - 0.5),
      songTitle: song.title,
      artist: song.artist,
      lyricSnippet: line,
      points: config.points + 5, // bonus for fill-in-blank difficulty
    });
  }
  return questions.sort(() => Math.random() - 0.5);
}

const SongMatchLyrics = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: gameStats } = useGameStats();
  const [lyricsMode, setLyricsMode] = useState<LyricsMode | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [questions, setQuestions] = useState<LyricsQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [answered, setAnswered] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const { data: songs = [] } = useQuery({
    queryKey: ["songmatch-lyrics-songs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("songs")
        .select("title, artist, lyrics_lrc")
        .not("lyrics_lrc", "is", null)
        .neq("lyrics_lrc", "")
        .limit(5000);
      if (error) throw error;
      return (data || []).filter((s: any) => s.lyrics_lrc && parseLrcLines(s.lyrics_lrc).length >= 3);
    },
    staleTime: 5 * 60 * 1000,
  });

  const startGame = useCallback(
    (diff: Difficulty) => {
      if (!lyricsMode) return;
      let q: LyricsQuestion[];
      if (lyricsMode === "title-to-lyrics") {
        q = generateTitleToLyricsQuestions(songs as any, diff, QUESTIONS_PER_ROUND);
      } else if (lyricsMode === "fill-in-blank") {
        q = generateFillInBlankQuestions(songs as any, diff, QUESTIONS_PER_ROUND);
      } else {
        q = generateLyricsToTitleQuestions(songs as any, diff, QUESTIONS_PER_ROUND);
      }
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
    [songs, lyricsMode]
  );

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

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
      setStreak((s) => {
        const newStreak = s + 1;
        setBestStreak((b) => Math.max(b, newStreak));
        return newStreak;
      });
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
          saveGameSession(user.id, "lyrics", difficulty, finalScore, maxScore, correctCount, questions.length, Math.max(bestStreak, correct ? streak + 1 : bestStreak));
          import("@/hooks/useChallenge").then(({ recordChallengeGame }) => recordChallengeGame("lyrics", difficulty, finalScore));
          if (gameStats) {
            const updatedStats = {
              ...gameStats,
              totalGamesPlayed: gameStats.totalGamesPlayed + 1,
              totalPoints: gameStats.totalPoints + score + (correct ? pointsEarned : 0),
              lyricsGames: gameStats.lyricsGames + 1,
              lyricsPoints: gameStats.lyricsPoints + score + (correct ? pointsEarned : 0),
              lyricsBestStreak: Math.max(gameStats.lyricsBestStreak, bestStreak, correct ? streak + 1 : bestStreak),
            };
            checkAndAwardAchievements(user.id, updatedStats);
          }
          queryClient.invalidateQueries({ queryKey: ["game-stats"] });
        }
      }
    }, 1200);
  };

  const modeLabel = LYRICS_MODES.find((m) => m.key === lyricsMode)?.label || "Lyrics Game";

  // Step 1: Mode Selection
  if (!lyricsMode) {
    return (
      <AppLayout>
        <div className="px-4 lg:px-6 pt-4 lg:pt-6 pb-8 max-w-md mx-auto">
          <button onClick={() => navigate("/games/songmatch")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 text-sm">
            <ArrowLeft className="w-4 h-4" /> Back to SongMatch
          </button>
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-serif font-bold text-foreground mb-1">Lyrics Game</h1>
            <p className="text-muted-foreground text-sm">Choose a game type</p>
          </div>
          <div className="space-y-3">
            {LYRICS_MODES.map((mode) => {
              const Icon = mode.icon;
              return (
                <button key={mode.key} onClick={() => setLyricsMode(mode.key)}
                  className="w-full glass-card p-4 flex items-center gap-4 hover:ring-2 hover:ring-primary/50 transition-all duration-300 text-left">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{mode.label}</p>
                    <p className="text-muted-foreground text-xs">{mode.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </AppLayout>
    );
  }

  // Step 2: Difficulty Selection
  if (!difficulty) {
    return (
      <AppLayout>
        <div className="px-4 lg:px-6 pt-4 lg:pt-6 pb-8 max-w-md mx-auto">
          <button onClick={() => setLyricsMode(null)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 text-sm">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-serif font-bold text-foreground mb-1">{modeLabel}</h1>
            <p className="text-muted-foreground text-sm">Select Difficulty</p>
          </div>
          <div className="space-y-3">
            {(["easy", "medium", "hard"] as Difficulty[]).map((d) => {
              const config = DIFFICULTY_CONFIG[d];
              return (
                <button key={d} onClick={() => startGame(d)} disabled={songs.length < OPTION_COUNT}
                  className="w-full glass-card p-4 flex items-center justify-between hover:ring-2 hover:ring-primary/50 transition-all duration-300 disabled:opacity-50">
                  <span className="font-semibold text-foreground">{config.emoji} {config.label}</span>
                  <span className={`${config.color} text-white text-xs font-bold px-3 py-1 rounded-full`}>+{config.points} pts</span>
                </button>
              );
            })}
          </div>
          {songs.length < OPTION_COUNT && <p className="text-center text-xs text-muted-foreground mt-4">Not enough songs with lyrics available</p>}
        </div>
      </AppLayout>
    );
  }

  // Game Complete
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
            <h3 className="font-semibold text-foreground text-sm mb-3">📖 Learning Insights</h3>
            <div className="space-y-3">
              {answers.map((a, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  {a.correct ? <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />}
                  <div>
                    <p className="font-medium text-foreground">{a.question.songTitle}</p>
                    <p className="text-muted-foreground italic line-clamp-1">"{a.question.lyricSnippet.split("\n")[0]}"</p>
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

  // Game Play
  const q = questions[currentQ];
  if (!q) return null;

  const questionLabel =
    lyricsMode === "lyrics-to-title" ? "Which song contains these lyrics?" :
    lyricsMode === "title-to-lyrics" ? "Which lyrics belong to this song?" :
    "Fill in the missing word:";

  const isLyricPrompt = lyricsMode === "lyrics-to-title" || lyricsMode === "fill-in-blank";

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
        <div className="glass-card p-6 mb-6">
          <p className="text-xs text-muted-foreground mb-3 font-medium">{questionLabel}</p>
          {isLyricPrompt ? (
            <p className="text-foreground font-serif text-lg leading-relaxed whitespace-pre-line italic">"{q.prompt}"</p>
          ) : (
            <p className="text-foreground font-serif text-xl font-bold">{q.prompt}</p>
          )}
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
            const displayOpt = lyricsMode === "title-to-lyrics"
              ? <span className="italic whitespace-pre-line line-clamp-2">"{opt}"</span>
              : opt;
            return (
              <button key={i} onClick={() => handleAnswer(opt)} className={cls} disabled={!!answered}>
                <span className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold flex-shrink-0">{letter}</span>
                {displayOpt}
              </button>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
};

export default SongMatchLyrics;
