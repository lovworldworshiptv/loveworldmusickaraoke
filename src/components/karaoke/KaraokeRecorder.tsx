import { useState, useRef, useEffect, useCallback } from "react";
import { Mic2, Square, Play, Pause, Trash2, RotateCcw, Share2, X, Copy, ExternalLink, Lock, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const SHARE_DOMAIN = "https://loveworldmusickaraoke.lovable.app";

interface KaraokeRecorderProps {
  songId: string;
  songTitle: string;
  instrumentalUrl?: string;
  isKaraokeMode: boolean;
  onClose: () => void;
  onRecordingStateChange?: (recording: boolean) => void;
}

const KaraokeRecorder = ({ songId, songTitle, instrumentalUrl, isKaraokeMode, onClose, onRecordingStateChange }: KaraokeRecorderProps) => {
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
  const [countdown, setCountdown] = useState<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const instrumentalRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    try {
      // Request mic access early
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
      });
      streamRef.current = stream;

      // 3-second countdown
      setCountdown(3);
      for (let i = 3; i >= 1; i--) {
        setCountdown(i);
        await new Promise(r => setTimeout(r, 1000));
      }
      setCountdown(null);

      // Determine supported mimeType
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") 
        ? "audio/webm;codecs=opus" 
        : MediaRecorder.isTypeSupported("audio/webm") 
          ? "audio/webm" 
          : "audio/mp4";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setRecordedBlob(blob);
        setRecordedUrl(url);
        setRecorded(true);
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      };
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(250); // collect data every 250ms
      setRecording(true);
      setRecorded(false);
      onRecordingStateChange?.(true);

      if (instrumentalUrl) {
        const inst = new Audio(instrumentalUrl);
        inst.play().catch(() => {});
        instrumentalRef.current = inst;
      }
    } catch (err: any) {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      setCountdown(null);
      toast.error("Microphone access denied. Please allow microphone in browser settings.");
    }
  }, [instrumentalUrl]);

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    instrumentalRef.current?.pause();
    setRecording(false);
    onRecordingStateChange?.(false);
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

  const shareRecording = async (destination: "my_karaoke" | "karaoke_stories") => {
    if (!user || !recordedBlob) return;
    setUploading(true);
    try {
      const ext = recordedBlob.type.includes("mp4") ? "mp4" : "webm";
      const filename = `${user.id}/${songId}-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("karaoke-recordings").upload(filename, recordedBlob, { contentType: recordedBlob.type });
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
      toast.success(destination === "karaoke_stories" ? "Shared to Karaoke Stories!" : "Shared to My Karaoke!");
      setShareUrl(`${SHARE_DOMAIN}/user/${user.id}`);
      setShowShare(true);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const copyLink = () => {
    const link = `${SHARE_DOMAIN}/user/${user?.id}`;
    navigator.clipboard.writeText(`Listen to my karaoke version of ${songTitle} on Loveworld Music Karaoke. ${link}`);
    toast.success("Link copied!");
  };

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      instrumentalRef.current?.pause();
      streamRef.current?.getTracks().forEach(t => t.stop());
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

      {/* Countdown overlay */}
      {countdown !== null && (
        <div className="flex flex-col items-center gap-2 py-6">
          <div className="w-20 h-20 rounded-full bg-destructive/20 flex items-center justify-center animate-pulse">
            <span className="text-4xl font-bold text-destructive">{countdown}</span>
          </div>
          <p className="text-xs text-muted-foreground">Get ready…</p>
        </div>
      )}

      {countdown === null && !recorded ? (
        <div className="flex flex-col items-center gap-3 py-2">
          {recording ? (
            <div className="flex flex-col items-center gap-3">
              <p className="text-xs text-destructive font-medium animate-pulse">● Recording… Sing along!</p>
              <Button onClick={stopRecording} variant="destructive" size="sm" className="gap-1.5">
                <Square className="w-3.5 h-3.5" fill="currentColor" /> Stop Recording
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <p className="text-xs text-muted-foreground">Record your voice over the instrumental</p>
              <Button onClick={startRecording} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground gap-1.5">
                <Mic2 className="w-4 h-4" /> Start Recording
              </Button>
            </div>
          )}
        </div>
      ) : null}

      {countdown === null && recorded && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Button onClick={playRecording} variant="outline" size="sm">
              {playing ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
              {playing ? "Pause" : "Play"}
            </Button>
            <Button onClick={deleteRecording} variant="outline" size="sm" className="text-destructive">
              <Trash2 className="w-4 h-4 mr-1" /> Delete
            </Button>
            <Button onClick={() => deleteRecording()} variant="outline" size="sm">
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
          <Button onClick={() => setShowShare(true)} disabled={uploading} className="bg-primary text-primary-foreground w-full">
            <Share2 className="w-4 h-4 mr-1" /> Share
          </Button>
        </div>
      )}

      {/* Share Options Modal */}
      <Dialog open={showShare} onOpenChange={setShowShare}>
        <DialogContent className="max-w-sm">
          <h3 className="text-lg font-serif font-bold text-foreground mb-4">Share Recording</h3>
          <p className="text-xs text-muted-foreground mb-4">Listen to my karaoke version of {songTitle} on Loveworld Music Karaoke.</p>
          <div className="space-y-2">
            <Button onClick={() => shareRecording("my_karaoke")} disabled={uploading} variant="outline" className="w-full justify-start">
              <Mic2 className="w-4 h-4 mr-2" /> {uploading ? "Sharing…" : "My Karaoke"}
            </Button>
            <Button onClick={() => shareRecording("karaoke_stories")} disabled={uploading} variant="outline" className="w-full justify-start">
              <Share2 className="w-4 h-4 mr-2" /> {uploading ? "Sharing…" : "Karaoke Stories"}
            </Button>
            <div className="flex items-center gap-2 w-full px-4 py-2 rounded-md border border-border text-sm text-muted-foreground opacity-60 cursor-not-allowed">
              <ExternalLink className="w-4 h-4" /> Share on KingsChat <span className="ml-auto text-[10px] bg-muted px-1.5 py-0.5 rounded">Coming soon</span>
            </div>
            <div className="flex items-center gap-2 w-full px-4 py-2 rounded-md border border-border text-sm text-muted-foreground opacity-60 cursor-not-allowed">
              <ExternalLink className="w-4 h-4" /> Share on Lettubbe <span className="ml-auto text-[10px] bg-muted px-1.5 py-0.5 rounded">Coming soon</span>
            </div>
            <Button onClick={copyLink} variant="outline" className="w-full justify-start">
              <Copy className="w-4 h-4 mr-2" /> Copy Link
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default KaraokeRecorder;
