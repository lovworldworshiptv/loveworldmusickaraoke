import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveChallenge, useMyEntry, useReferralGateStatus } from "@/hooks/useChallenge";

export const CHALLENGE_RESUME_KEY = "challenge_resume_path";

/**
 * Blocks entry to SongMatch game pages when the player is enrolled in an
 * active challenge, has crossed the referral gate score, and hasn't
 * completed the required number of referrals yet. Saves the current path so
 * the referrals page can auto-resume once invites are complete.
 */
export function useReferralGateGuard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { data: ch } = useActiveChallenge();
  const activeCh = ch && ch.status === "active" ? ch : null;
  const { data: entry } = useMyEntry(activeCh?.id);
  const { data: gate } = useReferralGateStatus(activeCh?.id);

  useEffect(() => {
    if (!user || !activeCh) return;
    if (entry?.status !== "approved") return;
    if (!gate?.blocked) return;
    const remaining = (gate as any).remaining ?? Math.max(0, gate.required - gate.refCount);
    try {
      localStorage.setItem(CHALLENGE_RESUME_KEY, location.pathname + location.search);
    } catch {}
    toast.error(
      `Refer ${remaining} more player${remaining === 1 ? "" : "s"} to keep playing the challenge.`
    );
    navigate("/games/challenge/referrals", { replace: true });
  }, [user, activeCh, entry?.status, gate?.blocked, gate?.required, gate?.refCount, location.pathname, location.search, navigate]);

  return gate?.blocked ?? false;
}
