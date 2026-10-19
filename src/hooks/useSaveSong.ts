import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useIsPremium } from "@/hooks/useIsPremium";
import { saveDownload } from "@/lib/downloadManager";
import type { PlayerSong } from "@/contexts/PlayerContext";

/**
 * Save one song for offline listening from any list: handles sign-in, the Premium
 * requirement (free songs excepted) and friendly messages. Returns `canSave(song)` for icons.
 */
export function useSaveSong() {
  const { user } = useAuth();
  const { isPremium } = useIsPremium();
  const navigate = useNavigate();

  const canSave = useCallback((song: PlayerSong) => isPremium || !!song.isFreeDownload, [isPremium]);

  const save = useCallback(async (song: PlayerSong) => {
    if (!song.audioUrl) return;
    if (!user) { navigate("/auth"); return; }
    if (!canSave(song)) {
      toast("Premium lets you save songs for offline listening.", { action: { label: "See plans", onClick: () => navigate("/subscription") } });
      return;
    }
    try {
      await saveDownload(song.id, song.audioUrl, {
        id: song.id, title: song.title, artist: song.artist, coverUrl: song.coverUrl, lyricsLrc: song.lyricsLrc,
        durationSeconds: song.durationSeconds || 0, album: song.album, isFreeDownload: !!song.isFreeDownload, downloadedAt: Date.now(),
      }, song.instrumentalUrl);
      toast.success(`Saved “${song.title}” for offline listening`);
    } catch (e) {
      const msg = (e as Error)?.message || "";
      if (msg !== "Download cancelled") toast.error(msg.startsWith("Sign in") ? msg : `Couldn't save “${song.title}” — tap to try again`);
    }
  }, [user, canSave, navigate]);

  return { save, canSave };
}
