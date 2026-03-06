import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Music, Clock, Play, Pause, Trash2, Share2, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface Recording {
  id: string;
  song_id: string;
  song_title: string;
  audio_url: string;
  created_at: string;
}

const MyKaraoke = () => {
  const { user } = useAuth();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [featureEnabled, setFeatureEnabled] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [shareRec, setShareRec] = useState<Recording | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    supabase.from("app_settings" as any).select("value").eq("key", "my_karaoke_visible").single()
      .then(({ data }: any) => {
        if (data) setFeatureEnabled(data.value === true);
      });
  }, []);

  const fetchRecordings = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("karaoke_recordings")
      .select("*")
      .eq("user_id", user.id)
      .gte("created_at", new Date(Date.now() - 24 * 3600000).toISOString())
      .order("created_at", { ascending: false }) as any;
    setRecordings(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchRecordings(); }, [user]);

  const playRecording = (rec: Recording) => {
    if (playingId === rec.id) { audioRef.current?.pause(); setPlayingId(null); return; }
    audioRef.current?.pause();
    const audio = new Audio(rec.audio_url);
    audio.onended = () => setPlayingId(null);
    audio.play();
    audioRef.current = audio;
    setPlayingId(rec.id);
  };

  const deleteRecording = async (rec: Recording) => {
    await supabase.from("karaoke_recordings").delete().eq("id", rec.id) as any;
    // Delete from storage
    const path = rec.audio_url.split("/karaoke-recordings/")[1];
    if (path) await supabase.storage.from("karaoke-recordings").remove([decodeURIComponent(path)]);
    setRecordings(r => r.filter(x => x.id !== rec.id));
    toast.success("Recording deleted");
  };

  const openShare = (rec: Recording) => {
    setShareRec(rec);
    setShowShare(true);
  };

  const timeLeft = (date: string) => {
    const expiresAt = new Date(date).getTime() + 24 * 3600000;
    const left = Math.max(0, expiresAt - Date.now());
    const hrs = Math.floor(left / 3600000);
    const mins = Math.floor((left % 3600000) / 60000);
    return `${hrs}h ${mins}m left`;
  };

  const shareText = shareRec ? `Listen to my karaoke version of ${shareRec.song_title} on Loveworld Music Karaoke.` : "";
  const shareUrl = user ? `${window.location.origin}/user/${user.id}` : "";

  if (!featureEnabled) return null;
  if (loading) return null;
  if (recordings.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Music className="w-4 h-4 text-gold" />
        <h3 className="text-sm font-semibold text-foreground">My Karaoke</h3>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          <Clock className="w-3 h-3" /> Live for 24h
        </span>
      </div>
      <div className="space-y-2">
        {recordings.map(rec => (
          <div key={rec.id} className="glass-card p-3 flex items-center gap-3">
            <button onClick={() => playRecording(rec)} className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center flex-shrink-0">
              {playingId === rec.id ? <Pause className="w-4 h-4 text-gold" /> : <Play className="w-4 h-4 text-gold ml-0.5" />}
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">{rec.song_title}</p>
              <p className="text-[10px] text-muted-foreground">{timeLeft(rec.created_at)}</p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => openShare(rec)} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
                <Share2 className="w-4 h-4" />
              </button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="p-1.5 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete recording?</AlertDialogTitle>
                    <AlertDialogDescription>This karaoke recording will be permanently deleted.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteRecording(rec)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={showShare} onOpenChange={setShowShare}>
        <DialogContent className="max-w-sm">
          <h3 className="text-lg font-serif font-bold text-foreground mb-4">Share Recording</h3>
          <p className="text-xs text-muted-foreground mb-4">{shareText}</p>
          <div className="space-y-2">
            <Button onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success("Link copied!"); }} variant="outline" className="w-full justify-start">
              <Copy className="w-4 h-4 mr-2" /> Copy Link
            </Button>
            <a href={`https://kingschat.online/share?text=${encodeURIComponent(shareText + " " + shareUrl)}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 w-full px-4 py-2 rounded-md border border-border text-sm hover:bg-muted transition-colors">
              <ExternalLink className="w-4 h-4" /> Share on KingsChat
            </a>
            <a href={`https://lettubbe.com/?share=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 w-full px-4 py-2 rounded-md border border-border text-sm hover:bg-muted transition-colors">
              <ExternalLink className="w-4 h-4" /> Share on Lettubbe
            </a>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyKaraoke;
