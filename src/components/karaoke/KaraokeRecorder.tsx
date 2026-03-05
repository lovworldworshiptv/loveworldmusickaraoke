import { useState, useRef, useEffect } from "react";
import { Mic2, Square, Play, Pause, Trash2, RotateCcw, Share2, X, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface KaraokeRecorderProps {
  songId: string;
  songTitle: string;
  instrumentalUrl?: string;
  isKaraokeMode: boolean;
  onClose: () => void;
}

const KaraokeRecorder = ({ songId, songTitle, instrumentalUrl, isKaraokeMode, onClose }: KaraokeRecorderProps) => {
  const { user } = useAuth();
  const [recording, setRecording] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [caption, setCaption] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const instrumentalRef = useRef<HTMLAudioElement | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setRecordedBlob(blob);
        setRecordedUrl(url);
        setRecorded(true);
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setRecording(true);
      setRecorded(false);

      if (instrumentalUrl) {
        const inst = new Audio(instrumentalUrl);
        inst.play().catch(() => {});
        instrumentalRef.current = inst;
      }
    } catch {
      toast.error("Microphone access denied");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    instrumentalRef.current?.pause();
    setRecording(false);
  };

  const playRecording = () => {
    if (!recordedUrl) return;
    if (playing) { audioRef.current?.pause(); setPlaying(false); return; }
    const audio = new Audio(recordedUrl);
    audio.onended = () => setPlaying(false);
    audio.play();
    audioRef.current = audio;
    setPlaying(true);
  };

  const deleteRecording = () => {
    audioRef.current?.pause();
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedBlob(null);
    setRecordedUrl(null);
    setRecorded(false);
    setPlaying(false);
    setCaption("");
  };

  const shareToMyKaraoke = async () => {
    if (!user || !recordedBlob) return;
    setUploading(true);
    try {
      const filename = `${user.id}/${songId}-${Date.now()}.webm`;
      const { error: uploadErr } = await supabase.storage.from("karaoke-recordings").upload(filename, recordedBlob, { contentType: "audio/webm" });
      if (uploadErr) throw uploadErr;
      const { data: { publicUrl } } = supabase.storage.from("karaoke-recordings").getPublicUrl(filename);
      const { error: dbErr } = await supabase.from("karaoke_recordings").insert({
        user_id: user.id,
        song_id: songId,
        song_title: songTitle,
        audio_url: publicUrl,
        caption: caption.trim() || null,
      } as any);
      if (dbErr) throw dbErr;
      toast.success("Shared to My Karaoke!");
      setShareUrl(`${window.location.origin}/user/${user.id}`);
      setShowShare(true);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success("Link copied!");
  };

  const shareText = `Listen to my karaoke version of ${songTitle} on Loveworld Music Karaoke.`;

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      instrumentalRef.current?.pause();
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
  }, []);

  return (
    <div className="glass-card p-4 rounded-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mic2 className="w-5 h-5 text-primary" />
          <h4 className="text-sm font-semibold text-foreground">Karaoke Recording</h4>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
      </div>

      {!recorded ? (
        <div className="flex flex-col items-center gap-4 py-4">
          {recording ? (
            <>
              <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center animate-pulse">
                <Mic2 className="w-8 h-8 text-destructive" />
              </div>
              <p className="text-xs text-muted-foreground">Recording… Sing along!</p>
              <Button onClick={stopRecording} variant="destructive" size="sm">
                <Square className="w-4 h-4 mr-1" /> Stop
              </Button>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                <Mic2 className="w-8 h-8 text-primary" />
              </div>
              <p className="text-xs text-muted-foreground">Record your voice over the instrumental</p>
              <Button onClick={startRecording} className="bg-primary text-primary-foreground">
                <Mic2 className="w-4 h-4 mr-1" /> Start Recording
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Button onClick={playRecording} variant="outline" size="sm">
              {playing ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
              {playing ? "Pause" : "Play"}
            </Button>
            <Button onClick={deleteRecording} variant="outline" size="sm" className="text-destructive">
              <Trash2 className="w-4 h-4 mr-1" /> Delete
            </Button>
            <Button onClick={() => { deleteRecording(); }} variant="outline" size="sm">
              <RotateCcw className="w-4 h-4 mr-1" /> Re-record
            </Button>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Add a caption (optional)</label>
            <Input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="e.g. My favorite worship song!"
              className="text-sm"
              maxLength={120}
            />
          </div>
          <Button onClick={shareToMyKaraoke} disabled={uploading} className="bg-primary text-primary-foreground w-full">
            <Share2 className="w-4 h-4 mr-1" /> {uploading ? "Sharing…" : "Share to My Karaoke"}
          </Button>
        </div>
      )}

      <Dialog open={showShare} onOpenChange={setShowShare}>
        <DialogContent className="max-w-sm">
          <h3 className="text-lg font-serif font-bold text-foreground mb-4">Share Your Recording</h3>
          <p className="text-xs text-muted-foreground mb-4">{shareText}</p>
          <div className="space-y-2">
            <Button onClick={copyLink} variant="outline" className="w-full justify-start">
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

export default KaraokeRecorder;
