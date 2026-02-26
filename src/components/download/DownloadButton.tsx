import { useState, useEffect } from "react";
import { Download, Lock, Check, Loader2, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useIsPremium } from "@/hooks/useIsPremium";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { supabase } from "@/integrations/supabase/client";
import { saveOfflineTrack, isTrackOffline, removeOfflineTrack } from "@/lib/offlineStorage";
import { hapticDownload } from "@/lib/nativeService";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface DownloadButtonProps {
  songId: string;
  title: string;
  artist: string;
  coverUrl?: string;
  isFreeDownload?: boolean;
  variant?: "icon" | "full";
  className?: string;
}

const DownloadButton = ({ songId, title, artist, coverUrl, isFreeDownload = false, variant = "icon", className = "" }: DownloadButtonProps) => {
  const { user } = useAuth();
  const { isPremium } = useIsPremium();
  const { isAdmin } = useIsAdmin();
  const [downloading, setDownloading] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const canDownload = isPremium || isAdmin || isFreeDownload;

  useEffect(() => {
    isTrackOffline(songId).then(setIsOffline);
  }, [songId]);

  const handleDownload = async () => {
    if (!user) {
      toast.error("Sign in to download");
      return;
    }

    if (!canDownload) {
      setShowUpgrade(true);
      return;
    }

    if (isOffline) return;

    setDownloading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-signed-url", {
        body: { songId },
      });

      if (error || !data?.signedUrl) {
        throw new Error(data?.error || "Failed to get download URL");
      }

      const response = await fetch(data.signedUrl);
      if (!response.ok) throw new Error("Failed to download audio");
      const audioBlob = await response.blob();

      await saveOfflineTrack(songId, audioBlob, {
        title: data.title || title,
        artist: data.artist || artist,
        coverUrl,
        lyricsLrc: data.lyricsLrc,
      });

      setIsOffline(true);
      hapticDownload();
      toast.success(`"${title}" saved for offline playback`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Download failed";
      toast.error(msg);
    } finally {
      setDownloading(false);
    }
  };

  const handleRemove = async () => {
    try {
      await removeOfflineTrack(songId);
      setIsOffline(false);
      toast.success("Removed from downloads");
    } catch {
      toast.error("Failed to remove download");
    }
  };

  if (isOffline) {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <span className="flex items-center gap-1 text-xs text-green-500">
          <Check className="w-3.5 h-3.5" /> Offline
        </span>
        <button onClick={handleRemove} className="p-1 text-muted-foreground hover:text-destructive transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  if (downloading) {
    return (
      <button disabled className={`flex items-center gap-1.5 text-muted-foreground ${className}`}>
        <Loader2 className="w-4 h-4 animate-spin" />
        {variant === "full" && <span className="text-xs">Downloading...</span>}
      </button>
    );
  }

  if (!canDownload) {
    return (
      <>
        <button
          onClick={() => setShowUpgrade(true)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gold/10 text-gold/60 transition-colors ${className}`}
        >
          <Lock className="w-3.5 h-3.5" />
          {variant === "full" && <span>Premium</span>}
        </button>
        <Dialog open={showUpgrade} onOpenChange={setShowUpgrade}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-foreground font-serif">Upgrade to Premium</DialogTitle>
              <DialogDescription>
                Download songs for offline listening, enjoy karaoke mode, and more — all for just $1/month.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 mt-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Download className="w-4 h-4 text-gold" /> Unlimited offline downloads
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="w-4 h-4 text-gold" /> Ad-free experience
              </div>
              <button
                onClick={() => setShowUpgrade(false)}
                className="w-full mt-2 py-2.5 rounded-xl gradient-gold text-primary-foreground font-semibold text-sm shadow-lg"
              >
                Get Premium — $1/month
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <button
      onClick={handleDownload}
      className={`flex items-center gap-1.5 text-muted-foreground hover:text-gold transition-colors ${className}`}
    >
      <Download className="w-4 h-4" />
      {variant === "full" && <span className="text-xs">{isFreeDownload ? "Free Download" : "Download"}</span>}
    </button>
  );
};

export default DownloadButton;
