import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveChallenge, useMyEntry, useReferralGateStatus } from "@/hooks/useChallenge";

/**
 * Blocks entry to SongMatch game pages when the player is enrolled in an
 * active challenge, has crossed the referral gate score, and hasn't
 * completed the required number of referrals yet.
 */
export function useReferralGateGuard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: ch } = useActiveChallenge();
  const activeCh = ch && ch.status === "active" ? ch : null;
  const { data: entry } = useMyEntry(activeCh?.id);
  const { data: gate } = useReferralGateStatus(activeCh?.id);

  useEffect(() => {
    if (!user || !activeCh) return;
    if (entry?.status !== "approved") return;
    if (!gate?.blocked) return;
    toast.error(
      `Refer ${gate.required - gate.refCount} more player${gate.required - gate.refCount === 1 ? "" : "s"} to keep playing the challenge.`
    );
    navigate("/games/challenge", { replace: true });
  }, [user, activeCh, entry?.status, gate?.blocked, gate?.required, gate?.refCount, navigate]);

  return gate?.blocked ?? false;
}
