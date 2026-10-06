import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, RotateCw, Loader2 } from "lucide-react";
import PlaybackProgress from "@/components/player/PlaybackProgress";

export interface SongVideo {
  id: string;
  video_url: string;
  video_type: string;
  language_code: string;
  offset_ms: number;
  thumbnail_url: string | null;
}

export const ytId = (url: string) => {
  const m = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/|live\/)([\w-]{11})/);
  return m ? m[1] : null;
};

interface Props {
  video: SongVideo;
  startAt: number;
  /** Ref the parent reads to get the current video position (song time) on exit */
  positionRef: React.MutableRefObject<() => number>;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;

/** Plays a song's video from the audio position with its own transport controls. */
const VideoMode = ({ video, startAt, positionRef }: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const offset = (video.offset_ms || 0) / 1000;
  const start = Math.max(0, startAt + offset);
  const yt = ytId(video.video_url);
  const [playing, setPlaying] = useState(true);
  const [time, setTime] = useState(start);
  const [dur, setDur] = useState(0);
  const [ready, setReady] = useState(false);
  const timeRef = useRef(start);
  timeRef.current = time;

  // YouTube: talk to the iframe player via postMessage
  const ytCmd = (func: string, args: unknown[] = []) =>
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), "*");

  useEffect(() => {
    if (!yt) return;
    const onMsg = (e: MessageEvent) => {
      if (typeof e.data !== "string" || !e.origin.includes("youtube")) return;
      try {
        const d = JSON.parse(e.data);
        const info = d.info;
        if (!info) return;
        if (typeof info.currentTime === "number") setTime(info.currentTime);
        if (typeof info.duration === "number" && info.duration > 0) setDur(info.duration);
        if (typeof info.playerState === "number") setPlaying(info.playerState === 1 || info.playerState === 3);
      } catch {}
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [yt]);

  const onIframeLoad = () => {
    setReady(true);
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: video.id }), "*");
  };

  useEffect(() => {
    positionRef.current = () => Math.max(0, (videoRef.current?.currentTime ?? timeRef.current) - offset);
  }, [offset, positionRef]);

  const toggle = () => {
    if (yt) { ytCmd(playing ? "pauseVideo" : "playVideo"); setPlaying(!playing); return; }
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {}); else v.pause();
  };

  useEffect(() => {
    if (yt) return;
    const player = videoRef.current;
    if (!player) return;
    player.load();
    player.play().catch(() => setPlaying(false));
  }, [video.video_url, yt]);

  const seek = (t: number) => {
    const target = Math.max(0, dur ? Math.min(t, dur) : t);
    if (yt) ytCmd("seekTo", [target, true]);
    else if (videoRef.current) videoRef.current.currentTime = target;
    setTime(target);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 min-h-0 gap-4">
      <div className="relative w-full max-w-3xl aspect-video rounded-2xl overflow-hidden glass-card glow-gold bg-background">
        {!ready && <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70"><Loader2 className="w-7 h-7 animate-spin text-gold" /></div>}
        {yt ? (
          <iframe
            ref={iframeRef}
            onLoad={onIframeLoad}
            className="w-full h-full"
            src={`https://www.youtube.com/embed/${yt}?autoplay=1&start=${Math.floor(start)}&playsinline=1&rel=0&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`}
            title="Song video"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            loading="eager"
          />
        ) : (
          <video
            ref={videoRef}
            src={video.video_url}
            poster={video.thumbnail_url || undefined}
            className="w-full h-full object-contain"
            autoPlay
            preload="auto"
            playsInline
            onClick={toggle}
            onLoadedMetadata={(e) => { e.currentTarget.currentTime = start; setDur(e.currentTarget.duration); }}
            onCanPlay={(e) => { setReady(true); e.currentTarget.play().catch(() => setPlaying(false)); }}
            onWaiting={() => setReady(false)}
            onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />
        )}
      </div>

      <div className="w-full max-w-3xl">
        <PlaybackProgress
          value={dur ? (time / dur) * 100 : 0}
          onValueChange={(value) => { if (dur) seek((value / 100) * dur); }}
          ariaLabel="Video position"
          className="mb-1.5"
        />
        <div className="flex justify-between text-[11px] text-muted-foreground font-medium">
          <span>{fmt(time)}</span><span>{dur ? `-${fmt(Math.max(0, dur - time))}` : ""}</span>
        </div>
        <div className="flex items-center justify-center gap-8 mt-2">
          <button onClick={() => seek(time - 10)} className="text-foreground hover:text-gold" aria-label="Back 10 seconds"><RotateCcw className="w-6 h-6" /></button>
          <button onClick={toggle} aria-label={playing ? "Pause video" : "Play video"}
            className="w-[72px] h-[72px] rounded-full bg-gradient-to-br from-gold via-gold-light to-gold flex items-center justify-center shadow-[0_6px_30px_hsl(43_70%_53%/0.6)] hover:scale-105 active:scale-95 transition-all">
            {playing ? <Pause className="w-8 h-8 text-primary-foreground" fill="currentColor" /> : <Play className="w-8 h-8 text-primary-foreground ml-1" fill="currentColor" />}
          </button>
          <button onClick={() => seek(time + 10)} className="text-foreground hover:text-gold" aria-label="Forward 10 seconds"><RotateCw className="w-6 h-6" /></button>
        </div>
      </div>
    </div>
  );
};

export default VideoMode;
