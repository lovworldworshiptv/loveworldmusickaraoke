import { useState, useCallback, useRef, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Music2, Trophy, Star, Zap, RotateCcw, Home, Play, Pause, Volume2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";

type Difficulty = "easy" | "medium" | "hard";

interface MelodyQuestion {
  audioUrl: string;
  correctTitle: string;
  options: string[];
  artist: string;
  points: number;
  clipDuration: number;
}

const DIFFICULTY_CONFIG = {
  easy: { label: "Easy", points: 10, optionCount: 2, clipDuration: 15, color: "bg-green-500", emoji: "🌱" },
  medium: { label: "Medium", points: 15, optionCount: 3, clipDuration: 8, color: "bg-amber-500", emoji: "🔥" },
  hard: { label: "Hard", points: 25, optionCount: 4, clipDuration: 4, color: "bg-red-500", emoji: "⚡" },
};

const QUESTIONS_PER_ROUND = 10;

function generateMelodyQuestions(
  songs: { title: string; artist: string; audio_url: string }[],
  difficulty: Difficulty,
  count: number
): MelodyQuestion[] {
  const config = DIFFICULTY_CONFIG[difficulty];
  const shuffled = [...songs].sort(() => Math.random() - 0.5);
  const questions: MelodyQuestion[] = [];
  const usedSongs = new Set<string>();

  for (const song of shuffled) {
    if (questions.length >= count) break;
    if (usedSongs.has(song.title)) continue;

    const otherSongs = shuffled
      .filter((s) => s.title !== song.title)
      .sort(() => Math.random() - 0.5)
      .slice(0, config.optionCount - 1)
      .map((s) => s.title);

    const options = [song.title, ...otherSongs].sort(() => Math.random() - 0.5);
    usedSongs.add(song.title);
    questions.push({
      audioUrl: song.audio_url,
      correctTitle: song.title,
      options,
      artist: song.artist,
      points: config.points,
      clipDuration: config.clipDuration,
    });
  }

  return questions.sort(() => Math.random() - 0.5);
}

const SongMatchMelody = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [questions, setQuestions] = useState<MelodyQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [answered, setAnswered] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playProgress, setPlayProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const progressRef = useRef<ReturnType<typeof setInterval>>();

  const { data: songs = [] } = useQuery({
    queryKey: ["songmatch-melody-songs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("songs")
        .select("title, artist, audio_url")
        .not("audio_url", "is", null)
        .neq("audio_url", "");
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const startGame = useCallback(
    (diff: Difficulty) => {
      const q = generateMelodyQuestions(songs as any, diff, QUESTIONS_PER_ROUND);
      setQuestions(q);
      setDifficulty(diff);
      setCurrentQ(0);
      setScore(0);
      setStreak(0);
      setAnswered(null);
      setCompleted(false);
      setIsPlaying(false);
      setPlayProgress(0);
    },
    [songs]
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (progressRef.current) clearInterval(progressRef.current);
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    };
  }, []);

  // Stop audio when moving to next question
  useEffect(() => {
    setIsPlaying(false);
    setPlayProgress(0);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (progressRef.current) clearInterval(progressRef.current);
  }, [currentQ]);

  const playClip = () => {
    if (!questions[currentQ]) return;
    const q = questions[currentQ];

    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (progressRef.current) clearInterval(progressRef.current);

    const audio = new Audio(q.audioUrl);
    audioRef.current = audio;

    // Start at a random point in the song (between 10s and 60s in)
    const startTime = 10 + Math.random() * 50;

    audio.currentTime = startTime;
    audio.play().then(() => {
      setIsPlaying(true);
      setPlayProgress(0);

      const startedAt = Date.now();
      progressRef.current = setInterval(() => {
        const elapsed = (Date.now() - startedAt) / 1000;
        setPlayProgress(Math.min(elapsed / q.clipDuration, 1));
        if (elapsed >= q.clipDuration) {
          audio.pause();
          setIsPlaying(false);
          if (progressRef.current) clearInterval(progressRef.current);
        }
      }, 100);
    }).catch(() => {
      setIsPlaying(false);
    });
  };

  const handleAnswer = (option: string) => {
    if (answered) return;
    setAnswered(option);
    if (audioRef.current) { audioRef.current.pause(); setIsPlaying(false); }

    const correct = option === questions[currentQ].correctTitle;
    if (correct) {
      const streakBonus = Math.floor(streak / 3) * 5;
      setScore((s) => s + questions[currentQ].points + streakBonus);
      setStreak((s) => s + 1);
    } else {
      setStreak(0);
    }

    timerRef.current = setTimeout(() => {
      if (currentQ + 1 < questions.length) {
        setCurrentQ((q) => q + 1);
        setAnswered(null);
      } else {
        setCompleted(true);
      }
    }, 1200);
  };

  // Difficulty Selection
  if (!difficulty) {
    return (
      <AppLayout>
        <div className="px-4 lg:px-6 pt-4 lg:pt-6 pb-8 max-w-md mx-auto">
          <button onClick={() => navigate("/games/songmatch")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 text-sm">
            <ArrowLeft className="w-4 h-4" /> Back to SongMatch
          </button>
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500 to-fuchsia-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Music2 className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-serif font-bold text-foreground mb-1">Melody Game</h1>
            <p className="text-muted-foreground text-sm">Listen to song clips and identify the title</p>
          </div>
          <p className="text-center text-sm text-muted-foreground mb-4">Select Difficulty</p>
          <div className="space-y-3">
            {(["easy", "medium", "hard"] as Difficulty[]).map((d) => {
              const config = DIFFICULTY_CONFIG[d];
              return (
                <button key={d} onClick={() => startGame(d)} disabled={songs.length < 3}
                  className="w-full glass-card p-4 flex items-center justify-between hover:ring-2 hover:ring-primary/50 transition-all duration-300 disabled:opacity-50">
                  <span className="font-semibold text-foreground">{config.emoji} {config.label}</span>
                  <span className={`${config.color} text-white text-xs font-bold px-3 py-1 rounded-full`}>+{config.points} pts</span>
                </button>
              );
            })}
          </div>
          {songs.length < 3 && (
            <p className="text-center text-xs text-muted-foreground mt-4">Not enough songs with audio available</p>
          )}
        </div>
      </AppLayout>
    );
  }

  // Game Complete
  if (completed) {
    const maxScore = questions.reduce((sum, q) => sum + q.points, 0);
    const pct = Math.round((score / maxScore) * 100);
    return (
      <AppLayout>
        <div className="px-4 lg:px-6 pt-4 lg:pt-6 pb-8 max-w-md mx-auto text-center">
          <div className="glass-card p-8">
            <Trophy className="w-16 h-16 text-amber-400 mx-auto mb-4" />
            <h2 className="text-2xl font-serif font-bold text-foreground mb-2">Game Complete!</h2>
            <p className="text-muted-foreground mb-4 text-sm capitalize">{difficulty} Mode</p>
            <div className="flex justify-center gap-1 mb-4">
              {[1, 2, 3].map((star) => (
                <Star key={star} className={`w-8 h-8 ${pct >= star * 30 ? "text-amber-400 fill-amber-400" : "text-muted-foreground"}`} />
              ))}
            </div>
            <p className="text-4xl font-bold text-amber-400 mb-1">{score}</p>
            <p className="text-sm text-muted-foreground mb-6">points earned</p>
            <div className="flex gap-3">
              <button onClick={() => startGame(difficulty)} className="flex-1 py-3 rounded-lg border border-border text-foreground hover:bg-muted transition-colors flex items-center justify-center gap-2 text-sm">
                <RotateCcw className="w-4 h-4" /> Retry
              </button>
              <button onClick={() => { setDifficulty(null); setCompleted(false); }} className="flex-1 py-3 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity flex items-center justify-center gap-2 text-sm">
                <Home className="w-4 h-4" /> Menu
              </button>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Game Play
  const q = questions[currentQ];
  if (!q) return null;

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 lg:pt-6 pb-8 max-w-lg mx-auto">
        <button onClick={() => { if (audioRef.current) audioRef.current.pause(); setDifficulty(null); }} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 text-sm">
          <ArrowLeft className="w-4 h-4" /> Quit
        </button>

        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-muted-foreground">Question {currentQ + 1}/{questions.length}</span>
          <div className="flex items-center gap-3">
            {streak >= 3 && (
              <span className="flex items-center gap-1 text-xs text-amber-400 font-medium">
                <Zap className="w-3 h-3" /> {streak}x streak
              </span>
            )}
            <span className="text-sm font-bold text-amber-400">{score} pts</span>
          </div>
        </div>

        <div className="w-full h-2 rounded-full bg-muted mb-6">
          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${((currentQ + 1) / questions.length) * 100}%` }} />
        </div>

        {/* Audio player card */}
        <div className="glass-card p-6 mb-6 text-center">
          <p className="text-xs text-muted-foreground mb-4 font-medium">Listen and identify the song</p>
          <button
            onClick={playClip}
            disabled={isPlaying}
            className="w-20 h-20 rounded-full bg-gradient-to-br from-pink-500 to-fuchsia-600 flex items-center justify-center mx-auto mb-4 shadow-lg hover:scale-105 transition-transform disabled:opacity-70"
          >
            {isPlaying ? <Volume2 className="w-8 h-8 text-white animate-pulse" /> : <Play className="w-8 h-8 text-white ml-1" />}
          </button>
          {/* Playback progress */}
          <div className="w-full h-1.5 rounded-full bg-muted">
            <div className="h-full rounded-full bg-pink-500 transition-all duration-100" style={{ width: `${playProgress * 100}%` }} />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {isPlaying ? "Playing..." : `Tap to play ${q.clipDuration}s clip`}
          </p>
        </div>

        {/* Options */}
        <div className="space-y-3">
          {q.options.map((opt) => {
            let cls = "w-full glass-card p-4 text-left text-sm font-medium transition-all duration-300 ";
            if (answered) {
              if (opt === q.correctTitle) cls += "ring-2 ring-green-500 text-green-400";
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
      </div>
    </AppLayout>
  );
};

export default SongMatchMelody;
