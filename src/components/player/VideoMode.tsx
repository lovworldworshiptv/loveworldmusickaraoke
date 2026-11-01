import { useEffect, useRef, useState, type ReactNode } from "react";
import { Play, Pause, RotateCcw, RotateCw, Loader2, AlertTriangle, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, Maximize, Minimize } from "lucide-react";
import PlaybackProgress from "@/components/player/PlaybackProgress";
import { isKingsSpacePage } from "@/lib/videoLinks";
import { saveVideoProgress, type VideoStatusStore } from "@/lib/videoProgress";

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
  /** Called when the video finishes playing. */
  onEnded?: () => void;
  /** Previous / next song in the queue, staying in Video mode (hidden when absent). */
  onPrev?: () => void;
  onNext?: () => void;
  /** Ref the parent reads to know whether the video was playing (e.g. when the player is minimised). */
  playingRef?: React.MutableRefObject<() => boolean>;
  /** Up Next: the frame (moved with transforms when the list opens) and its fixed slot. */
  frameRef?: (el: HTMLDivElement | null) => void;
  slotRef?: (el: HTMLDivElement | null) => void;
  /** Shares time / duration / playing with the Up Next sheet. */
  status?: VideoStatusStore;
  /** Repeat-one: the video starts again instead of ending. */
  repeatOne?: boolean;
  /** Song id used to remember how far this video was watched. */
  progressKey?: string;
  /** Drawn over the video's corner (e.g. the Up Next countdown). */
  overlay?: ReactNode;
  /** Shuffle / repeat buttons (hidden when absent). */
  shuffleOn?: boolean;
  onShuffle?: () => void;
  repeatMode?: "off" | "all" | "one";
  onRepeat?: () => void;
  /** Phone Up Next layout: 30% less space between the controls and the Up Next strip. */
  tightBottom?: boolean;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;

/** Plays a song's video from the audio position with its own transport controls. */
const VideoMode = ({ video, startAt, positionRef, onEnded, onPrev, onNext, playingRef, frameRef, slotRef, status, repeatOne, progressKey, overlay, shuffleOn, onShuffle, repeatMode = "off", onRepeat, tightBottom }: Props) => {
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
  const endedRef = useRef(onEnded);
  const endedFiredRef = useRef(false);
  const repeatOneRef = useRef(repeatOne);
  repeatOneRef.current = repeatOne;
  endedRef.current = () => {
    if (repeatOneRef.current) {
      // Repeat-one: play this video again from the start.
      if (yt) { ytCmd("seekTo", [0, true]); ytCmd("playVideo"); }
      else if (videoRef.current) { videoRef.current.currentTime = 0; videoRef.current.play().catch(() => {}); }
      return;
    }
    // YouTube can report "ended" repeatedly; advance only once per video.
    if (endedFiredRef.current) return;
    endedFiredRef.current = true;
    onEnded?.();
  };
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
        if (typeof info.playerState === "number") {
          setPlaying(info.playerState === 1 || info.playerState === 3);
          if (info.playerState === 0) endedRef.current?.();
        }
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

  const playingNowRef = useRef(playing);
  playingNowRef.current = playing;
  useEffect(() => {
    if (playingRef) playingRef.current = () => playingNowRef.current;
  }, [playingRef]);

  // Share live state with Up Next and remember how far this video was watched.
  const durRef = useRef(0);
  durRef.current = dur;
  useEffect(() => { status?.set({ time, dur, playing }); }, [status, time, dur, playing]);
  const lastSavedRef = useRef(0);
  useEffect(() => {
    if (!progressKey || !dur) return;
    const now = Date.now();
    if (now - lastSavedRef.current < 5000) return;
    lastSavedRef.current = now;
    saveVideoProgress(progressKey, time, dur);
  }, [progressKey, time, dur]);
  useEffect(() => () => { if (progressKey) saveVideoProgress(progressKey, timeRef.current, durRef.current); }, [progressKey]);

  const toggle = () => {
    if (yt) { ytCmd(playing ? "pauseVideo" : "playVideo"); setPlaying(!playing); return; }
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {}); else v.pause();
  };

  useEffect(() => { if (status) status.controls.toggle = toggle; });

  useEffect(() => { endedFiredRef.current = false; }, [video.video_url]);

  // A web-page link (not a video file) can never play — say so instead of spinning forever.
  const pageLink = !yt && isKingsSpacePage(video.video_url);
  const [failed, setFailed] = useState<string | null>(
    pageLink ? "This video link points to a web page, not a video file. Ask an admin to update it." : null,
  );
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    setFailed(pageLink ? "This video link points to a web page, not a video file. Ask an admin to update it." : null);
    setSlow(false);
  }, [video.video_url, pageLink]);

  // Show a gentle "slow connection" hint, then a retry prompt if nothing arrives.
  useEffect(() => {
    if (ready || failed) { setSlow(false); return; }
    const hint = window.setTimeout(() => setSlow(true), 6000);
    const giveUp = window.setTimeout(() => {
      if (yt || (videoRef.current && videoRef.current.readyState < 2)) {
        setFailed("This video is taking too long to load. Check your connection and try again.");
      }
    }, 30000);
    return () => { clearTimeout(hint); clearTimeout(giveUp); };
  }, [ready, failed, yt, video.video_url]);

  const retry = () => {
    if (pageLink) return;
    setFailed(null);
    setReady(false);
    if (yt) {
      const f = iframeRef.current;
      if (f) f.src = f.src;
      return;
    }
    const v = videoRef.current;
    if (!v) return;
    const at = v.currentTime || start;
    v.load();
    v.addEventListener("loadedmetadata", () => { v.currentTime = at; }, { once: true });
    v.play().catch(() => setPlaying(false));
  };

  // Slow network: if the video stalls for 10s, re-request it from the same position.
  useEffect(() => {
    if (yt || ready) return;
    const t = window.setTimeout(() => {
      const v = videoRef.current;
      if (!v || v.readyState >= 3) return;
      const at = v.currentTime;
      v.load();
      v.addEventListener("loadedmetadata", () => { v.currentTime = at; }, { once: true });
      v.play().catch(() => {});
    }, 10000);
    return () => clearTimeout(t);
  }, [ready, yt]);

  useEffect(() => {
    if (yt || pageLink) return;
    const player = videoRef.current;
    if (!player) return;
    player.load();
    player.play().catch(() => setPlaying(false));
  }, [video.video_url, yt, pageLink]);

  const seek = (t: number) => {
    const target = Math.max(0, dur ? Math.min(t, dur) : t);
    if (yt) ytCmd("seekTo", [target, true]);
    else if (videoRef.current) videoRef.current.currentTime = target;
    setTime(target);
  };

  const RepeatIcon = repeatMode === "one" ? Repeat1 : Repeat;

  // --- Full screen: the whole video frame (so the countdown can show on big screens); iPhone uses its own video player ---
  const frameElRef = useRef<HTMLDivElement | null>(null);
  const setFrame = (el: HTMLDivElement | null) => { frameElRef.current = el; frameRef?.(el); };
  const [isFs, setIsFs] = useState(false);
  useEffect(() => {
    const on = () => {
      const fsEl = document.fullscreenElement || (document as any).webkitFullscreenElement;
      const now = !!fsEl && fsEl === frameElRef.current;
      setIsFs(now);
      if (!now) { try { (screen.orientation as any)?.unlock?.(); } catch { /* not supported */ } }
    };
    document.addEventListener("fullscreenchange", on);
    document.addEventListener("webkitfullscreenchange", on);
    return () => { document.removeEventListener("fullscreenchange", on); document.removeEventListener("webkitfullscreenchange", on); };
  }, []);
  const canElementFs = typeof document !== "undefined" && !!(document.fullscreenEnabled || (document as any).webkitFullscreenEnabled);
  const canNativeFs = !yt && typeof HTMLVideoElement !== "undefined" && "webkitEnterFullscreen" in HTMLVideoElement.prototype;
  const canFullscreen = !pageLink && (canElementFs || canNativeFs);
  const toggleFullscreen = async () => {
    const frame = frameElRef.current as (HTMLDivElement & { webkitRequestFullscreen?: () => void }) | null;
    if (isFs) {
      try { await (document.exitFullscreen?.() ?? (document as any).webkitExitFullscreen?.()); } catch { /* already closed */ }
      return;
    }
    try {
      if (canElementFs && frame) {
        await (frame.requestFullscreen?.() ?? frame.webkitRequestFullscreen?.());
        // Phones: turn sideways for a bigger picture where the browser allows it.
        try { await (screen.orientation as any)?.lock?.("landscape"); } catch { /* not supported */ }
        return;
      }
    } catch { /* fall back below */ }
    try { (videoRef.current as any)?.webkitEnterFullscreen?.(); } catch { /* not supported */ }
  };
  return (
    <div className={`flex-1 flex flex-col items-center px-4 min-h-0 ${tightBottom ? "" : "justify-center"}`}>
      {/* Free space is split 65/35 on phones so the gap above Up Next is 30% smaller than centred. */}
      {tightBottom && <div aria-hidden="true" className="min-h-0" style={{ flexGrow: 65 }} />}
      <div className="w-full flex flex-col items-center gap-4">
      <div ref={slotRef} className="relative w-full max-w-3xl aspect-video">
      <div ref={setFrame} className="absolute inset-0 rounded-2xl overflow-hidden glass-card glow-gold bg-background">
        {failed ? (
          <div role="alert" className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-background/90 px-6 text-center">
            <AlertTriangle className="w-7 h-7 text-gold" />
            <p className="text-sm text-foreground font-medium">{failed}</p>
            <button onClick={retry} className="px-4 py-2 rounded-full bg-gold text-primary-foreground text-sm font-semibold hover:opacity-90">Try again</button>
          </div>
        ) : !ready && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/70">
            <Loader2 className="w-7 h-7 animate-spin text-gold" />
            {slow && <p className="text-xs text-muted-foreground">Slow connection — still loading…</p>}
          </div>
        )}
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
        ) : pageLink ? null : (
          <video
            ref={videoRef}
            src={video.video_url}
            poster={video.thumbnail_url || undefined}
            className="w-full h-full object-contain"
            autoPlay
            preload="auto"
            playsInline
            controls={isFs}
            onClick={isFs ? undefined : toggle}
            onLoadedMetadata={(e) => { if (e.currentTarget.currentTime < 0.5) e.currentTarget.currentTime = start; setDur(e.currentTarget.duration); }}
            onPlaying={() => { setReady(true); setFailed(null); }}
            onCanPlay={(e) => { setReady(true); e.currentTarget.play().catch(() => setPlaying(false)); }}
            onWaiting={() => setReady(false)}
            onError={() => { setReady(true); setFailed("This video couldn't be played. Check your connection and try again."); }}
            onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => endedRef.current?.()}
          />
        )}
        {overlay}
        {canFullscreen && (
          <button type="button" onClick={toggleFullscreen} aria-label={isFs ? "Exit full screen" : "Full screen"}
            className={`absolute z-30 w-10 h-10 rounded-full flex items-center justify-center bg-background/60 backdrop-blur-sm text-foreground hover:text-gold hover:bg-background/80 transition-colors ${isFs ? "top-3 left-3" : yt ? "top-2 left-2" : "bottom-2 right-2"}`}>
            {isFs ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>
        )}
      </div>
      </div>

      <div className="w-full max-w-3xl">
        <div data-no-sheet-drag>
        <PlaybackProgress
          value={dur ? (time / dur) * 100 : 0}
          onValueChange={(value) => { if (dur) seek((value / 100) * dur); }}
          ariaLabel="Video position"
          className="mb-1.5"
        />
        </div>
        <div className="flex justify-between text-[11px] text-muted-foreground font-medium">
          <span>{fmt(time)}</span><span>{dur ? `-${fmt(Math.max(0, dur - time))}` : ""}</span>
        </div>
        <div className={`flex items-center mt-2 ${onShuffle || onRepeat ? "justify-between w-full max-w-md mx-auto" : "justify-center gap-6 sm:gap-8"}`}>
          {onShuffle && (
            <button onClick={onShuffle} aria-label={shuffleOn ? "Shuffle on" : "Shuffle off"} aria-pressed={!!shuffleOn}
              className={`w-10 h-10 flex items-center justify-center transition-colors ${shuffleOn ? "text-gold" : "text-muted-foreground hover:text-foreground"}`}>
              <Shuffle className="w-5 h-5" />
            </button>
          )}
          {onPrev && <button onClick={onPrev} className="w-10 h-10 flex items-center justify-center text-foreground hover:text-gold" aria-label="Previous video"><SkipBack className="w-6 h-6" fill="currentColor" /></button>}
          <button onClick={() => seek(time - 10)} className="w-10 h-10 flex items-center justify-center text-foreground hover:text-gold" aria-label="Back 10 seconds"><RotateCcw className="w-6 h-6" /></button>
          <button onClick={toggle} aria-label={playing ? "Pause video" : "Play video"}
            className="w-[72px] h-[72px] rounded-full bg-gradient-to-br from-gold via-gold-light to-gold flex items-center justify-center shadow-[0_6px_30px_hsl(43_70%_53%/0.6)] hover:scale-105 active:scale-95 transition-all">
            {playing ? <Pause className="w-8 h-8 text-primary-foreground" fill="currentColor" /> : <Play className="w-8 h-8 text-primary-foreground ml-1" fill="currentColor" />}
          </button>
          <button onClick={() => seek(time + 10)} className="w-10 h-10 flex items-center justify-center text-foreground hover:text-gold" aria-label="Forward 10 seconds"><RotateCw className="w-6 h-6" /></button>
          {onNext && <button onClick={onNext} className="w-10 h-10 flex items-center justify-center text-foreground hover:text-gold" aria-label="Next video"><SkipForward className="w-6 h-6" fill="currentColor" /></button>}
          {onRepeat && (
            <button onClick={onRepeat} aria-label={repeatMode === "one" ? "Repeat this video" : repeatMode === "all" ? "Repeat all" : "Repeat off"}
              className={`relative w-10 h-10 flex items-center justify-center transition-colors ${repeatMode !== "off" ? "text-gold" : "text-muted-foreground hover:text-foreground"}`}>
              <RepeatIcon className="w-5 h-5" />
              {repeatMode === "one" && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-gold shadow-[0_0_6px_hsl(var(--gold)/0.8)]" />}
            </button>
          )}
        </div>
      </div>
      </div>
      {tightBottom && <div aria-hidden="true" className="min-h-0" style={{ flexGrow: 35 }} />}
    </div>
  );
};

export default VideoMode;
