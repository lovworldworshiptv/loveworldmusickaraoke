import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Challenge {
  id: string;
  name: string;
  description: string | null;
  entry_fee: number;
  prize_pool: number;
  prize_distribution: Record<string, number>;
  start_date: string;
  end_date: string;
  status: string;
  max_daily_scoring_games: number | null;
  max_referrals_per_user: number | null;
  qualification_min_games: number;
}

export const useActiveChallenge = () => {
  return useQuery<Challenge | null>({
    queryKey: ["active-challenge"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("challenges" as any)
        .select("*")
        .in("status", ["active", "completed"])
        .order("start_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return (data as any) || null;
    },
    staleTime: 60_000,
  });
};

export const isChallengeClosed = (ch: Challenge | null | undefined) => {
  if (!ch) return false;
  return ch.status === "completed" || ch.status === "cancelled" || new Date(ch.end_date) < new Date();
};

export const useMyEntry = (challengeId?: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["challenge-entry", challengeId, user?.id],
    queryFn: async () => {
      if (!user?.id || !challengeId) return null;
      const { data } = await supabase
        .from("challenge_entries" as any)
        .select("*")
        .eq("challenge_id", challengeId)
        .eq("user_id", user.id)
        .maybeSingle();
      return (data as any) || null;
    },
    enabled: !!user?.id && !!challengeId,
  });
};

export const useMyScore = (challengeId?: string) => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["challenge-my-score", challengeId, user?.id],
    queryFn: async () => {
      if (!user?.id || !challengeId) return null;
      const { data } = await supabase
        .from("challenge_scores" as any)
        .select("*")
        .eq("challenge_id", challengeId)
        .eq("user_id", user.id)
        .maybeSingle();
      return (data as any) || null;
    },
    enabled: !!user?.id && !!challengeId,
  });
};

export const useLeaderboard = (challengeId?: string) => {
  const qc = useQueryClient();
  useEffect(() => {
    if (!challengeId) return;
    const ch = supabase
      .channel(`challenge-scores-${challengeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "challenge_scores", filter: `challenge_id=eq.${challengeId}` }, () => {
        qc.invalidateQueries({ queryKey: ["challenge-leaderboard", challengeId] });
        qc.invalidateQueries({ queryKey: ["challenge-my-score", challengeId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [challengeId, qc]);

  return useQuery({
    queryKey: ["challenge-leaderboard", challengeId],
    queryFn: async () => {
      if (!challengeId) return [];
      const { data } = await supabase
        .from("challenge_scores" as any)
        .select("user_id, total_score, games_played, qualified, final_rank")
        .eq("challenge_id", challengeId)
        .order("total_score", { ascending: false })
        .limit(500);
      const rows = (data as any[]) || [];
      const ids = rows.map((r: any) => r.user_id);
      if (ids.length === 0) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, username, avatar_url")
        .in("user_id", ids);
      const map = new Map((profs || []).map((p: any) => [p.user_id, p]));
      return rows.map((r: any, i: number) => ({
        ...r, rank: i + 1, username: map.get(r.user_id)?.username || "User", avatar_url: map.get(r.user_id)?.avatar_url || null,
      }));
    },
    enabled: !!challengeId,
  });
};

export const useParticipantCount = (challengeId?: string) => {
  return useQuery({
    queryKey: ["challenge-participants", challengeId],
    queryFn: async () => {
      if (!challengeId) return 0;
      const { count } = await supabase
        .from("challenge_entries" as any)
        .select("id", { count: "exact", head: true })
        .eq("challenge_id", challengeId)
        .eq("status", "approved");
      return count || 0;
    },
    enabled: !!challengeId,
  });
};

export function buildReferralUrl(userId: string) {
  return `https://loveworldmusickaraoke.com/smchallenge?ref=${userId}`;
}

export async function recordChallengeGame(mode: "lyrics" | "melody" | "category", difficulty: string | null, score: number) {
  try {
    await supabase.functions.invoke("record-challenge-game", { body: { mode, difficulty, score } });
  } catch (e) {
    console.warn("[challenge] record failed", e);
  }
}
