import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface GameStats {
  totalGamesPlayed: number;
  totalPoints: number;
  lyricsGames: number;
  lyricsPoints: number;
  lyricsBestStreak: number;
  melodyGames: number;
  melodyPoints: number;
  melodyBestStreak: number;
  categoryGames: number;
  categoryPoints: number;
  categoryBestStreak: number;
  achievements: string[];
}

export const ACHIEVEMENTS = [
  { key: "lyrics_scholar", label: "Lyrics Scholar", description: "Complete 10 Lyrics games", icon: "📖", requirement: (s: GameStats) => s.lyricsGames >= 10 },
  { key: "melody_master", label: "Melody Master", description: "Complete 10 Melody games", icon: "🎵", requirement: (s: GameStats) => s.melodyGames >= 10 },
  { key: "category_master", label: "Category Master", description: "Complete 10 Category games", icon: "📂", requirement: (s: GameStats) => s.categoryGames >= 10 },
  { key: "songs_master", label: "Loveworld Songs Master", description: "Earn all 3 game badges", icon: "👑", requirement: (s: GameStats) => s.lyricsGames >= 10 && s.melodyGames >= 10 && s.categoryGames >= 10 },
  { key: "first_game", label: "First Steps", description: "Complete your first game", icon: "🌱", requirement: (s: GameStats) => s.totalGamesPlayed >= 1 },
  { key: "points_100", label: "Century", description: "Earn 100 total points", icon: "💯", requirement: (s: GameStats) => s.totalPoints >= 100 },
  { key: "points_500", label: "High Scorer", description: "Earn 500 total points", icon: "🔥", requirement: (s: GameStats) => s.totalPoints >= 500 },
  { key: "streak_5", label: "On Fire", description: "Get a 5+ answer streak", icon: "⚡", requirement: (s: GameStats) => s.lyricsBestStreak >= 5 || s.melodyBestStreak >= 5 || s.categoryBestStreak >= 5 },
];

export function useGameStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["game-stats", user?.id],
    queryFn: async (): Promise<GameStats> => {
      if (!user?.id) throw new Error("Not authenticated");

      const [sessionsRes, achievementsRes] = await Promise.all([
        supabase.from("game_sessions").select("*").eq("user_id", user.id),
        supabase.from("user_achievements").select("achievement_key").eq("user_id", user.id),
      ]);

      const sessions = (sessionsRes.data as any[]) || [];
      const achievements = (achievementsRes.data || []).map((a: any) => a.achievement_key);

      const byMode = (mode: string) => sessions.filter((s) => s.game_mode === mode);
      const lyr = byMode("lyrics");
      const mel = byMode("melody");
      const cat = byMode("category");

      return {
        totalGamesPlayed: sessions.length,
        totalPoints: sessions.reduce((sum, s) => sum + s.score, 0),
        lyricsGames: lyr.length,
        lyricsPoints: lyr.reduce((sum, s) => sum + s.score, 0),
        lyricsBestStreak: Math.max(0, ...lyr.map((s) => s.best_streak)),
        melodyGames: mel.length,
        melodyPoints: mel.reduce((sum, s) => sum + s.score, 0),
        melodyBestStreak: Math.max(0, ...mel.map((s) => s.best_streak)),
        categoryGames: cat.length,
        categoryPoints: cat.reduce((sum, s) => sum + s.score, 0),
        categoryBestStreak: Math.max(0, ...cat.map((s) => s.best_streak)),
        achievements,
      };
    },
    enabled: !!user?.id,
    staleTime: 30 * 1000,
  });
}

export async function saveGameSession(
  userId: string,
  gameMode: string,
  difficulty: string,
  score: number,
  maxScore: number,
  correctAnswers: number,
  totalQuestions: number,
  bestStreak: number
) {
  await supabase.from("game_sessions").insert({
    user_id: userId,
    game_mode: gameMode,
    difficulty,
    score,
    max_score: maxScore,
    correct_answers: correctAnswers,
    total_questions: totalQuestions,
    best_streak: bestStreak,
  } as any);
}

export async function checkAndAwardAchievements(userId: string, stats: GameStats) {
  for (const ach of ACHIEVEMENTS) {
    if (stats.achievements.includes(ach.key)) continue;
    if (ach.requirement(stats)) {
      try {
        await supabase.from("user_achievements").insert({
          user_id: userId,
          achievement_key: ach.key,
        } as any);
      } catch {
        // Ignore duplicate
      }
    }
  }
}
