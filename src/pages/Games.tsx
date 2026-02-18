import { useState, useEffect, useMemo, useCallback } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Trophy, Lock, CheckCircle2, ArrowLeft, Star, Music } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";

interface GeneratedQuestion {
  songTitle: string;
  artist: string;
  lyricText: string;
  missingWord: string;
  options: string[];
}

interface GameLevel {
  id: string;
  level: number;
  title: string;
  image_url: string | null;
  is_active: boolean;
}

// Parse LRC format lyrics into clean text lines
function parseLrcLines(lrc: string): string[] {
  return lrc
    .split("\n")
    .map((line) => line.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, "").trim())
    .filter((line) => line.length > 3 && !/^[♪♫]+$/.test(line));
}

// Pick a meaningful word to blank out (4+ chars, not common filler)
function pickMissingWord(line: string): string | null {
  const fillerWords = new Set([
    "the", "and", "for", "are", "but", "not", "you", "all", "can", "had",
    "her", "was", "one", "our", "out", "has", "his", "how", "its", "may",
    "who", "did", "get", "let", "say", "she", "too", "use", "with", "that",
    "this", "will", "each", "make", "like", "long", "look", "many", "some",
    "them", "then", "been", "have", "from", "they", "were", "your", "what",
    "when", "which", "would", "there", "their", "about", "could", "other",
    "into", "than", "just", "very", "come", "know", "take", "want",
  ]);

  const words = line.split(/\s+/).filter(
    (w) => w.length >= 4 && !fillerWords.has(w.toLowerCase()) && /^[a-zA-Z'-]+$/.test(w)
  );
  if (words.length === 0) return null;
  return words[Math.floor(Math.random() * words.length)];
}

// Generate distractor options from a pool of words
function generateOptions(correctWord: string, wordPool: string[]): string[] {
  const distractors = wordPool
    .filter((w) => w.toLowerCase() !== correctWord.toLowerCase() && w.length >= 3)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  // If not enough distractors, pad with variations
  while (distractors.length < 3) {
    const filler = ["Grace", "Glory", "Praise", "Faith", "Love", "Spirit", "Heaven", "Power", "Light", "Peace"]
      .filter((w) => w.toLowerCase() !== correctWord.toLowerCase() && !distractors.includes(w));
    if (filler.length > 0) distractors.push(filler[Math.floor(Math.random() * filler.length)]);
    else break;
  }

  const options = [correctWord, ...distractors.slice(0, 3)];
  return options.sort(() => Math.random() - 0.5);
}

// Generate questions from songs with lyrics
function generateQuestionsFromSongs(
  songs: { title: string; artist: string; lyrics_lrc: string }[],
  count: number,
  seed: number
): GeneratedQuestion[] {
  // Deterministic-ish shuffle using seed
  const shuffled = [...songs].sort((a, b) => {
    const hashA = (a.title.charCodeAt(0) * 31 + seed) % 1000;
    const hashB = (b.title.charCodeAt(0) * 31 + seed) % 1000;
    return hashA - hashB;
  });

  // Build a global word pool for distractors
  const wordPool: string[] = [];
  for (const song of shuffled) {
    const lines = parseLrcLines(song.lyrics_lrc);
    for (const line of lines) {
      line.split(/\s+/).forEach((w) => {
        if (w.length >= 4 && /^[a-zA-Z'-]+$/.test(w)) wordPool.push(w);
      });
    }
  }
  const uniqueWords = [...new Set(wordPool)];

  const questions: GeneratedQuestion[] = [];
  const usedLines = new Set<string>();

  for (const song of shuffled) {
    if (questions.length >= count) break;
    const lines = parseLrcLines(song.lyrics_lrc);
    // Shuffle lines
    const shuffledLines = [...lines].sort(() => Math.random() - 0.5);

    for (const line of shuffledLines) {
      if (questions.length >= count) break;
      if (usedLines.has(line.toLowerCase())) continue;

      const missingWord = pickMissingWord(line);
      if (!missingWord) continue;

      usedLines.add(line.toLowerCase());

      const displayLine = line.replace(
        new RegExp(`\\b${missingWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"),
        "______"
      );

      questions.push({
        songTitle: song.title,
        artist: song.artist,
        lyricText: displayLine,
        missingWord,
        options: generateOptions(missingWord, uniqueWords),
      });
    }
  }

  return questions;
}

const QUESTIONS_PER_LEVEL = 10;

const Games = () => {
  const { user } = useAuth();
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [completedLevels, setCompletedLevels] = useState<Set<number>>(new Set());
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([]);

  // Fetch songs that have lyrics
  const { data: songsWithLyrics = [], isLoading } = useQuery({
    queryKey: ["games-songs-with-lyrics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("songs")
        .select("title, artist, lyrics_lrc")
        .not("lyrics_lrc", "is", null)
        .neq("lyrics_lrc", "");
      if (error) throw error;
      return (data || []).filter((s: any) => s.lyrics_lrc && parseLrcLines(s.lyrics_lrc).length >= 3);
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch game levels from DB
  const { data: dbLevels = [] } = useQuery({
    queryKey: ["game-levels"],
    queryFn: async () => {
      const { data } = await supabase.from("game_levels").select("*").eq("is_active", true).order("level");
      return (data || []) as GameLevel[];
    },
  });

  // Load user progress
  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_game_progress")
      .select("level_id, completed")
      .eq("user_id", user.id)
      .eq("completed", true)
      .then(({ data }) => {
        if (data && dbLevels.length > 0) {
          const completedNums = new Set<number>();
          data.forEach((p: any) => {
            const lvl = dbLevels.find((l) => l.id === p.level_id);
            if (lvl) completedNums.add(lvl.level);
          });
          setCompletedLevels(completedNums);
        }
      });
  }, [user, dbLevels]);

  // Calculate how many levels we can offer based on available lyrics
  const totalPossibleQuestions = useMemo(() => {
    let count = 0;
    for (const song of songsWithLyrics) {
      const lines = parseLrcLines(song.lyrics_lrc);
      count += lines.filter((line) => pickMissingWord(line) !== null).length;
    }
    return count;
  }, [songsWithLyrics]);

  const maxLevels = Math.max(1, Math.floor(totalPossibleQuestions / QUESTIONS_PER_LEVEL));

  // Merge DB levels with dynamic availability
  const levels = useMemo(() => {
    if (dbLevels.length > 0) {
      return dbLevels.filter((l) => l.level <= maxLevels);
    }
    // Fallback: generate level entries if none in DB
    return Array.from({ length: Math.min(5, maxLevels) }, (_, i) => ({
      id: `auto-${i + 1}`,
      level: i + 1,
      title: `Lyrics Challenge ${i + 1}`,
      image_url: null,
      is_active: true,
    }));
  }, [dbLevels, maxLevels]);

  const startLevel = useCallback(
    (levelNum: number) => {
      const questions = generateQuestionsFromSongs(
        songsWithLyrics as any,
        QUESTIONS_PER_LEVEL,
        levelNum * 7919 // different seed per level for variety
      );
      setGeneratedQuestions(questions);
      setSelectedLevel(levelNum);
      setCurrentQ(0);
      setScore(0);
      setAnswered(null);
      setCompleted(false);
    },
    [songsWithLyrics]
  );

  const handleAnswer = (option: string) => {
    if (answered) return;
    setAnswered(option);
    if (option === generatedQuestions[currentQ].missingWord) {
      setScore((s) => s + 1);
    }
    setTimeout(() => {
      if (currentQ + 1 < generatedQuestions.length) {
        setCurrentQ((q) => q + 1);
        setAnswered(null);
      } else {
        setCompleted(true);
        if (selectedLevel !== null) {
          setCompletedLevels((prev) => new Set([...prev, selectedLevel]));
          // Save progress
          if (user && dbLevels.length > 0) {
            const lvl = dbLevels.find((l) => l.level === selectedLevel);
            if (lvl) {
              supabase.from("user_game_progress").upsert(
                { user_id: user.id, level_id: lvl.id, completed: true, score: score + (option === generatedQuestions[currentQ].missingWord ? 1 : 0), completed_at: new Date().toISOString() },
                { onConflict: "user_id,level_id" }
              ).then(() => {});
            }
          }
        }
      }
    }, 1200);
  };

  const isLevelUnlocked = (level: number) => {
    if (level === 1) return true;
    return completedLevels.has(level - 1);
  };

  // Quiz view
  if (selectedLevel !== null && !completed && generatedQuestions.length > 0) {
    const q = generatedQuestions[currentQ];
    if (!q) return null;
    return (
      <AppLayout>
        <div className="px-4 lg:px-6 pt-4 lg:pt-6 max-w-lg mx-auto">
          <button onClick={() => setSelectedLevel(null)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="w-4 h-4" /> Back to Levels
          </button>

          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-serif font-bold text-foreground">Level {selectedLevel}</h3>
            <span className="text-sm text-gold font-medium">{currentQ + 1}/{generatedQuestions.length}</span>
          </div>

          {/* Progress */}
          <div className="w-full h-2 rounded-full bg-muted mb-6">
            <div className="h-full rounded-full gradient-gold transition-all duration-500" style={{ width: `${((currentQ + 1) / generatedQuestions.length) * 100}%` }} />
          </div>

          {/* Question */}
          <div className="glass-card p-6 mb-6">
            <p className="text-xs text-gold mb-1 font-medium">{q.songTitle}</p>
            <p className="text-[10px] text-muted-foreground mb-3">{q.artist}</p>
            <p className="text-lg font-serif text-foreground leading-relaxed">
              {q.lyricText}
            </p>
          </div>

          {/* Options */}
          <div className="grid grid-cols-2 gap-3">
            {q.options.map((opt) => {
              let cls = "glass-card p-4 text-center text-sm font-medium transition-all duration-300 ";
              if (answered) {
                if (opt === q.missingWord) cls += "ring-2 ring-green-500 text-green-400";
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

  // Completion view
  if (completed && selectedLevel !== null) {
    const percentage = Math.round((score / generatedQuestions.length) * 100);
    return (
      <AppLayout>
        <div className="px-4 lg:px-6 pt-4 lg:pt-6 max-w-md mx-auto text-center">
          <div className="glass-card p-8">
            <Trophy className="w-16 h-16 text-gold mx-auto mb-4" />
            <h2 className="text-2xl font-serif font-bold gradient-gold-text mb-2">Level Complete!</h2>
            <p className="text-muted-foreground mb-4">Level {selectedLevel}</p>
            <div className="flex justify-center gap-1 mb-4">
              {[1, 2, 3].map((star) => (
                <Star key={star} className={`w-8 h-8 ${percentage >= star * 30 ? "text-gold fill-gold" : "text-muted-foreground"}`} />
              ))}
            </div>
            <p className="text-3xl font-bold text-gold mb-1">{score}/{generatedQuestions.length}</p>
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

  // Levels view
  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 lg:pt-6">
        <h2 className="text-2xl font-serif font-bold text-foreground mb-2">Loveworld Music Games</h2>
        <p className="text-sm text-muted-foreground mb-1">Complete the lyrics challenge!</p>
        <p className="text-xs text-muted-foreground/60 mb-6">
          <Music className="w-3 h-3 inline mr-1" />
          {songsWithLyrics.length} song{songsWithLyrics.length !== 1 ? "s" : ""} with lyrics available
        </p>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card p-4 animate-pulse h-20 rounded-xl" />
            ))}
          </div>
        ) : songsWithLyrics.length < 3 ? (
          <div className="glass-card p-8 text-center">
            <Music className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-foreground font-medium mb-1">Not enough lyrics yet</p>
            <p className="text-sm text-muted-foreground">Upload songs with lyrics to unlock games</p>
          </div>
        ) : (
          <div className="space-y-4">
            {levels.map((level) => {
              const unlocked = isLevelUnlocked(level.level);
              const done = completedLevels.has(level.level);
              return (
                <button key={level.id} disabled={!unlocked}
                  onClick={() => startLevel(level.level)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all duration-300 ${
                    unlocked ? "glass-card hover:glow-gold cursor-pointer" : "glass-card opacity-50"
                  }`}>
                  <div className="w-14 h-14 rounded-full flex items-center justify-center gradient-purple border-2 border-border flex-shrink-0 overflow-hidden">
                    {level.image_url ? (
                      <img src={level.image_url} alt="" className="w-full h-full object-cover" />
                    ) : done ? (
                      <CheckCircle2 className="w-7 h-7 text-gold" />
                    ) : !unlocked ? (
                      <Lock className="w-6 h-6 text-muted-foreground" />
                    ) : (
                      <Trophy className="w-6 h-6 text-gold" />
                    )}
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-semibold text-foreground">Level {level.level}</p>
                    <p className="text-xs text-muted-foreground">{level.title}</p>
                  </div>
                  <span className="text-xs text-gold">{QUESTIONS_PER_LEVEL} Quizzes</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div className="h-8" />
    </AppLayout>
  );
};

export default Games;
