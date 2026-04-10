import { useState, useRef, useEffect, useCallback } from "react";
import { Mic2, Square, Play, Pause, Trash2, RotateCcw, Share2, X, Copy, ExternalLink, Volume2, Headphones, Minimize2, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { toast } from "sonner";

const SHARE_DOMAIN = "https://loveworldmusickaraoke.com";
const COUNTDOWN_SECONDS = 3;
const LEVEL_BAR_COUNT = 24;

const toDirectUrl = (url?: string): string | undefined => {
  if (!url) return undefined;
  const trimmed = url.trim();
  const match = trimmed.match(/\/file\/d\/([^/]+)/);
  if (match) return `https://drive.google.com/uc?export=download&id=${match[1]}`;
  return trimmed;
};

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const fetchInstrumentalBuffer = async (url: string, audioContext: AudioContext): Promise<AudioBuffer> => {
  const proxyResp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-audio`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ url }),
  });

  if (!proxyResp.ok) {
    const errText = await proxyResp.text().catch(() => "");
    throw new Error(`Failed to load instrumental (${proxyResp.status}) ${errText}`.trim());
  }

  const arrayBuffer = await proxyResp.arrayBuffer();
  if (!arrayBuffer.byteLength) throw new Error("Failed to load instrumental");
  return audioContext.decodeAudioData(arrayBuffer);
};

const formatRecordTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

interface KaraokeRecorderProps {
  songId: string;
  songTitle: string;
  instrumentalUrl?: string;
  isKaraokeMode: boolean;
  onClose: () => void;
  onRecordingStateChange?: (recording: boolean) => void;
  onMinimize?: () => void;
  isMinimized?: boolean;
  externalStopRef?: React.MutableRefObject<(() => void) | null>;
}

/* ─── Real-time Level Meter ─── */
const LevelMeter = ({ analyser }: { analyser: AnalyserNode | null }) => {
  const [levels, setLevels] = useState<number[]>(new Array(LEVEL_BAR_COUNT).fill(0));
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!analyser) { setLevels(new Array(LEVEL_BAR_COUNT).fill(0)); return; }
    const dataArray = new Uint8Array(analyser.fftSize);
    const tick = () => {
      analyser.getByteTimeDomainData(dataArray);
      // Compute RMS chunks across the waveform data
      const chunkSize = Math.floor(dataArray.length / LEVEL_BAR_COUNT);
      const newLevels: number[] = [];
      for (let i = 0; i < LEVEL_BAR_COUNT; i++) {
        let sum = 0;
        for (let j = 0; j < chunkSize; j++) {
          const v = (dataArray[i * chunkSize + j] - 128) / 128;
          sum += v * v;
        }
        newLevels.push(Math.sqrt(sum / chunkSize));
      }
      setLevels(newLevels);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [analyser]);

  return (
    <div className="flex items-end justify-center gap-[2px] h-16 w-full px-2">
      {levels.map((level, i) => {
        const height = Math.max(3, Math.min(64, level * 200));
        const intensity = Math.min(1, level * 3);
        return (
          <div
            key={i}
            className="w-[3px] rounded-full transition-all duration-75"
            style={{
              height: `${height}px`,
              background: intensity > 0.7
                ? `hsl(0, 85%, 55%)`
                : intensity > 0.4
                  ? `hsl(45, 90%, 55%)`
                  : `hsl(var(--primary))`,
              opacity: 0.6 + intensity * 0.4,
            }}
          />
        );
      })}
    </div>
  );
};

/* ─── Waveform Visualizer for Playback ─── */
const WaveformVisualizer = ({ audioUrl, isPlaying, progress }: { audioUrl: string | null; isPlaying: boolean; progress: number }) => {
  const [waveform, setWaveform] = useState<number[]>([]);
  const BAR_COUNT = 60;

  useEffect(() => {
    if (!audioUrl) return;
    // Generate a pseudo-waveform from the audio blob
    const generate = async () => {
      try {
        const resp = await fetch(audioUrl);
        const buffer = await resp.arrayBuffer();
        const ctx = new AudioContext();
        const decoded = await ctx.decodeAudioData(buffer);
        const raw = decoded.getChannelData(0);
        const step = Math.floor(raw.length / BAR_COUNT);
        const bars: number[] = [];
        for (let i = 0; i < BAR_COUNT; i++) {
          let sum = 0;
          for (let j = 0; j < step; j++) {
            sum += Math.abs(raw[i * step + j]);
          }
          bars.push(sum / step);
        }
        const max = Math.max(...bars, 0.01);
        setWaveform(bars.map((b) => b / max));
        ctx.close();
      } catch {
        // Fallback static waveform
        setWaveform(Array.from({ length: BAR_COUNT }, () => 0.2 + Math.random() * 0.6));
      }
    };
    generate();
  }, [audioUrl]);

  if (waveform.length === 0) return null;

  const playedIndex = Math.floor(progress * BAR_COUNT);

  return (
    <div className="flex items-center justify-center gap-[1.5px] h-12 w-full">
      {waveform.map((level, i) => (
        <div
          key={i}
          className="w-[2.5px] rounded-full transition-colors duration-150"
          style={{
            height: `${Math.max(4, level * 48)}px`,
            background: i <= playedIndex ? `hsl(var(--primary))` : `hsl(var(--muted-foreground) / 0.3)`,
          }}
        />
      ))}
    </div>
  );
};

/* ─── Main Recorder ─── */
const KaraokeRecorder = ({ songId, songTitle, instrumentalUrl, isKaraokeMode, onClose, onRecordingStateChange, onMinimize, externalStopRef }: KaraokeRecorderProps) => {
  const { user } = useAuth();
  const { isPlaying, togglePlay, volume: playerVolume, setVolume: setPlayerVolume } = usePlayer();
  const savedVolumeRef = useRef<number>(0.7);
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
  const [recordDuration, setRecordDuration] = useState(0);
  const [instrumentalVolume, setInstrumentalVolume] = useState(80);
  const [loadingInstrumental, setLoadingInstrumental] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const instrumentalStopRef = useRef<(() => void) | null>(null);
  const instrumentalGainRef = useRef<GainNode | null>(null);
  const recordTimerRef = useRef<number>(0);
  const recordStartRef = useRef<number>(0);
  const playbackRafRef = useRef<number>(0);

  // Update instrumental volume in real-time
  useEffect(() => {
    if (instrumentalGainRef.current) {
      instrumentalGainRef.current.gain.value = instrumentalVolume / 100;
    }
  }, [instrumentalVolume]);

  // Recording timer
  useEffect(() => {
    if (recording) {
      recordStartRef.current = Date.now();
      const tick = () => {
        setRecordDuration((Date.now() - recordStartRef.current) / 1000);
        recordTimerRef.current = window.requestAnimationFrame(tick);
      };
      recordTimerRef.current = window.requestAnimationFrame(tick);
      return () => cancelAnimationFrame(recordTimerRef.current);
    } else {
      cancelAnimationFrame(recordTimerRef.current);
    }
  }, [recording]);

  const startRecording = useCallback(async () => {
    let stream: MediaStream | null = null;
    let audioContext: AudioContext | null = null;

    try {
      // Mute the player but keep it playing so lyrics stay synced
      savedVolumeRef.current = playerVolume;
      setPlayerVolume(0);
      if (!isPlaying) togglePlay();

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
      } catch {
        toast.error("Microphone access denied. Please allow microphone access in your browser/app settings.");
        return;
      }

      streamRef.current = stream;
      audioContext = new AudioContext();
      if (audioContext.state === "suspended") await audioContext.resume();
      audioContextRef.current = audioContext;

      const destination = audioContext.createMediaStreamDestination();

      // Mic → analyser → destination (for recording + level meter)
      const micSource = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      micSource.connect(analyser);
      analyser.connect(destination);
      setAnalyserNode(analyser);

      // Load instrumental
      const normalizedUrl = toDirectUrl(instrumentalUrl);
      let instrumentalBuffer: AudioBuffer | null = null;
      if (normalizedUrl) {
        try {
          setLoadingInstrumental(true);
          instrumentalBuffer = await fetchInstrumentalBuffer(normalizedUrl, audioContext);
        } catch (err: any) {
          console.warn("Instrumental load failed:", err.message);
          toast.info("Instrumental couldn't load — recording mic only");
        } finally {
          setLoadingInstrumental(false);
        }
      }

      // Countdown
      setCountdown(COUNTDOWN_SECONDS);
      for (let i = COUNTDOWN_SECONDS; i >= 1; i--) {
        setCountdown(i);
        await wait(1000);
      }
      setCountdown(null);

      // Start MediaRecorder
      const mixedStream = destination.stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4";

      const mediaRecorder = new MediaRecorder(mixedStream, { mimeType });
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setRecordedBlob(blob);
        setRecordedUrl(url);
        setRecorded(true);
        setAnalyserNode(null);

        instrumentalStopRef.current?.();
        instrumentalStopRef.current = null;
        stream?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        audioContextRef.current?.close();
        audioContextRef.current = null;
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(250);

      // Play instrumental (into recording mix + speaker output)
      if (instrumentalBuffer) {
        const gainNode = audioContext.createGain();
        gainNode.gain.value = instrumentalVolume / 100;
        instrumentalGainRef.current = gainNode;

        const instrumentalSource = audioContext.createBufferSource();
        instrumentalSource.buffer = instrumentalBuffer;
        instrumentalSource.connect(gainNode);
        gainNode.connect(destination);       // → recording mix
        gainNode.connect(audioContext.destination); // → speaker

        instrumentalSource.start();
        instrumentalStopRef.current = () => {
          try { instrumentalSource.stop(); } catch { /* noop */ }
          instrumentalSource.disconnect();
        };
      }

      setRecording(true);
      setRecorded(false);
      setRecordDuration(0);
      onRecordingStateChange?.(true);
    } catch (err: any) {
      stream?.getTracks().forEach((t) => t.stop());
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      instrumentalStopRef.current?.();
      instrumentalStopRef.current = null;
      audioContext?.close();
      audioContextRef.current = null;
      setCountdown(null);
      setAnalyserNode(null);
      toast.error(err.message || "Failed to start recording.");
    }
  }, [instrumentalUrl, isPlaying, togglePlay, onRecordingStateChange, instrumentalVolume]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    instrumentalStopRef.current?.();
    instrumentalStopRef.current = null;
    instrumentalGainRef.current = null;
    setRecording(false);
    onRecordingStateChange?.(false);
  }, [onRecordingStateChange]);

  // Expose stop to parent via ref
  useEffect(() => {
    if (externalStopRef) {
      externalStopRef.current = recording ? stopRecording : null;
    }
    return () => { if (externalStopRef) externalStopRef.current = null; };
  }, [recording, stopRecording, externalStopRef]);

  const playRecording = () => {
    if (!recordedUrl) return;
    if (playing) { audioRef.current?.pause(); setPlaying(false); cancelAnimationFrame(playbackRafRef.current); return; }
    const audio = new Audio(recordedUrl);
    audio.onended = () => { setPlaying(false); setPlaybackProgress(0); cancelAnimationFrame(playbackRafRef.current); };
    audio.play();
    audioRef.current = audio;
    setPlaying(true);

    const trackProgress = () => {
      if (audio.duration) setPlaybackProgress(audio.currentTime / audio.duration);
      playbackRafRef.current = requestAnimationFrame(trackProgress);
    };
    playbackRafRef.current = requestAnimationFrame(trackProgress);
  };

  const deleteRecording = () => {
    audioRef.current?.pause();
    cancelAnimationFrame(playbackRafRef.current);
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedBlob(null);
    setRecordedUrl(null);
    setRecorded(false);
    setPlaying(false);
    setPlaybackProgress(0);
    setCaption("");
    setRecordDuration(0);
  };

  const [sharingTo, setSharingTo] = useState<"my_karaoke" | "karaoke_stories" | null>(null);

  const shareRecording = async (destination: "my_karaoke" | "karaoke_stories") => {
    if (!user || !recordedBlob) return;
    setSharingTo(destination);
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
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      setSharingTo(null);
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
      cancelAnimationFrame(playbackRafRef.current);
      instrumentalStopRef.current?.();
      instrumentalStopRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioContextRef.current?.close();
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
  }, [recordedUrl]);

  return (
    <div className="rounded-2xl overflow-hidden border border-border/50 bg-gradient-to-b from-background to-muted/30 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b border-border/30">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-destructive/15 flex items-center justify-center">
            <Mic2 className="w-4 h-4 text-destructive" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-foreground leading-tight">Recording Studio</h4>
            <p className="text-[10px] text-muted-foreground truncate max-w-[180px]">{songTitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {recording && onMinimize && (
            <button onClick={onMinimize} className="w-7 h-7 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors" title="Minimize to see lyrics">
              <Minimize2 className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors">
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Countdown overlay */}
        {countdown !== null && (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="w-24 h-24 rounded-full bg-destructive/10 border-2 border-destructive/30 flex items-center justify-center animate-pulse">
              <span className="text-5xl font-black text-destructive">{countdown}</span>
            </div>
            <p className="text-sm font-medium text-muted-foreground">Get ready to sing…</p>
          </div>
        )}

        {/* Loading instrumental indicator */}
        {loadingInstrumental && countdown === null && (
          <div className="flex items-center justify-center gap-2 py-4">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-muted-foreground">Loading instrumental track…</span>
          </div>
        )}

        {/* Recording state */}
        {countdown === null && !loadingInstrumental && !recorded && (
          <div className="space-y-4">
            {recording ? (
              <div className="space-y-3">
                {/* Live level meter */}
                <div className="bg-muted/40 rounded-xl p-3 border border-border/20">
                  <LevelMeter analyser={analyserNode} />
                </div>

                {/* Timer + controls */}
                <div className="flex flex-col items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />
                    <span className="font-mono text-2xl font-bold text-foreground tracking-wider">
                      {formatRecordTime(recordDuration)}
                    </span>
                  </div>

                  <Button
                    onClick={stopRecording}
                    variant="destructive"
                    size="lg"
                    className="rounded-full w-14 h-14 p-0 shadow-lg shadow-destructive/20"
                  >
                    <Square className="w-5 h-5" fill="currentColor" />
                  </Button>
                  <p className="text-xs text-muted-foreground">Tap to stop recording</p>
                </div>

                {/* Instrumental volume control */}
                {instrumentalUrl && (
                  <div className="flex items-center gap-2 px-2">
                    <Volume2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-[10px] text-muted-foreground w-16 flex-shrink-0">Track Vol</span>
                    <Slider
                      value={[instrumentalVolume]}
                      onValueChange={([v]) => setInstrumentalVolume(v)}
                      max={100}
                      step={1}
                      className="flex-1"
                    />
                    <span className="text-[10px] text-muted-foreground w-6 text-right">{instrumentalVolume}%</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 py-4">
                {/* Idle waveform placeholder */}
                <div className="flex items-center justify-center gap-[2px] h-12 w-full px-4 opacity-30">
                  {Array.from({ length: LEVEL_BAR_COUNT }).map((_, i) => (
                    <div
                      key={i}
                      className="w-[3px] rounded-full bg-primary"
                      style={{ height: `${8 + Math.sin(i * 0.5) * 12 + Math.random() * 8}px` }}
                    />
                  ))}
                </div>

                <p className="text-xs text-muted-foreground text-center max-w-[220px]">
                  Record your voice over the instrumental track
                </p>

                {/* Instrumental volume pre-set */}
                {instrumentalUrl && (
                  <div className="flex items-center gap-2 w-full max-w-[260px]">
                    <Volume2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-[10px] text-muted-foreground w-16 flex-shrink-0">Track Vol</span>
                    <Slider
                      value={[instrumentalVolume]}
                      onValueChange={([v]) => setInstrumentalVolume(v)}
                      max={100}
                      step={1}
                      className="flex-1"
                    />
                    <span className="text-[10px] text-muted-foreground w-6 text-right">{instrumentalVolume}%</span>
                  </div>
                )}

                <Button
                  onClick={startRecording}
                  size="lg"
                  className="bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-full w-16 h-16 p-0 shadow-lg shadow-destructive/25 transition-transform hover:scale-105"
                >
                  <Mic2 className="w-6 h-6" />
                </Button>
                <span className="text-[10px] text-muted-foreground">Tap to record</span>
              </div>
            )}
          </div>
        )}

        {/* Playback / Review state */}
        {countdown === null && recorded && (
          <div className="space-y-4">
            {/* Waveform */}
            <div className="bg-muted/40 rounded-xl p-3 border border-border/20">
              <WaveformVisualizer audioUrl={recordedUrl} isPlaying={playing} progress={playbackProgress} />
            </div>

            {/* Duration label */}
            <div className="flex justify-between px-1">
              <span className="text-[10px] text-muted-foreground font-mono">
                {playing && audioRef.current ? formatRecordTime(audioRef.current.currentTime) : "00:00"}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {formatRecordTime(recordDuration)}
              </span>
            </div>

            {/* Transport controls */}
            <div className="flex items-center justify-center gap-3">
              <Button
                onClick={playRecording}
                size="lg"
                className="rounded-full w-12 h-12 p-0 bg-primary hover:bg-primary/90 shadow-lg"
              >
                {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </Button>
              <Button onClick={deleteRecording} variant="outline" size="sm" className="rounded-full text-destructive border-destructive/30 hover:bg-destructive/10">
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
              </Button>
              <Button onClick={deleteRecording} variant="outline" size="sm" className="rounded-full">
                <RotateCcw className="w-3.5 h-3.5 mr-1" /> Redo
              </Button>
            </div>

            {/* Caption */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Add caption</label>
              <Input
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="e.g. My favorite worship song!"
                className="text-sm rounded-xl bg-muted/30"
                maxLength={120}
              />
            </div>

            {/* Share button */}
            <Button
              onClick={() => setShowShare(true)}
              disabled={uploading}
              className="w-full rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground font-semibold shadow-md"
            >
              <Share2 className="w-4 h-4 mr-2" /> Share Recording
            </Button>
          </div>
        )}
      </div>

      {/* Share Options Modal */}
      <Dialog open={showShare} onOpenChange={setShowShare}>
        <DialogContent className="max-w-sm">
          <h3 className="text-lg font-bold text-foreground mb-1">Share Recording</h3>
          <p className="text-xs text-muted-foreground mb-4">Listen to my karaoke version of {songTitle} on Loveworld Music Karaoke.</p>
          <div className="space-y-2">
            <Button onClick={() => shareRecording("my_karaoke")} disabled={uploading} variant="outline" className="w-full justify-start rounded-xl">
              <Mic2 className="w-4 h-4 mr-2" /> {sharingTo === "my_karaoke" ? "Sharing…" : "My Karaoke"}
            </Button>
            <Button onClick={() => shareRecording("karaoke_stories")} disabled={uploading} variant="outline" className="w-full justify-start rounded-xl">
              <Share2 className="w-4 h-4 mr-2" /> {sharingTo === "karaoke_stories" ? "Sharing…" : "Karaoke Stories"}
            </Button>
            <div className="flex items-center gap-2 w-full px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground opacity-60 cursor-not-allowed">
              <ExternalLink className="w-4 h-4" /> Share on KingsChat <span className="ml-auto text-[10px] bg-muted px-1.5 py-0.5 rounded">Coming soon</span>
            </div>
            <div className="flex items-center gap-2 w-full px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground opacity-60 cursor-not-allowed">
              <ExternalLink className="w-4 h-4" /> Share on Lettubbe <span className="ml-auto text-[10px] bg-muted px-1.5 py-0.5 rounded">Coming soon</span>
            </div>
            <Button onClick={copyLink} variant="outline" className="w-full justify-start rounded-xl">
              <Copy className="w-4 h-4 mr-2" /> Copy Link
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default KaraokeRecorder;
