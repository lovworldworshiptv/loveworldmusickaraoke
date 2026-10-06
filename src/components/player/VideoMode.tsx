import { useEffect, useRef } from "react";

export interface SongVideo {
  id: string;
  video_url: string;
  video_type: string;
  language_code: string;
  offset_ms: number;
  thumbnail_url: string | null;
}

const ytId = (url: string) => {
  const m = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  return m ? m[1] : null;
};

interface Props {
  video: SongVideo;
  startAt: number;
  /** Ref the parent reads to get the current video position on exit */
  positionRef: React.MutableRefObject<() => number>;
}

/** Plays a song's video starting at the audio position; exposes its position for hand-back. */
const VideoMode = ({ video, startAt, positionRef }: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const offset = (video.offset_ms || 0) / 1000;
  const start = Math.max(0, startAt + offset);
  const yt = ytId(video.video_url);

  useEffect(() => {
    if (yt) {
      const t0 = Date.now();
      positionRef.current = () => startAt + (Date.now() - t0) / 1000;
    } else {
      positionRef.current = () => Math.max(0, (videoRef.current?.currentTime ?? start) - offset);
    }
  }, [yt, startAt, start, offset, positionRef]);

  return (
    <div className="flex-1 flex items-center justify-center px-4 min-h-0">
      <div className="w-full max-w-3xl aspect-video rounded-2xl overflow-hidden glass-card glow-gold bg-background">
        {yt ? (
          <iframe
            className="w-full h-full"
            src={`https://www.youtube.com/embed/${yt}?autoplay=1&start=${Math.floor(start)}&playsinline=1&rel=0`}
            title="Song video"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        ) : (
          <video
            ref={videoRef}
            src={video.video_url}
            poster={video.thumbnail_url || undefined}
            className="w-full h-full object-contain"
            controls
            autoPlay
            playsInline
            onLoadedMetadata={(e) => { e.currentTarget.currentTime = start; }}
          />
        )}
      </div>
    </div>
  );
};

export default VideoMode;
