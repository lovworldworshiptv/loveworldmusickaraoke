import { createContext, useContext, useState, useRef, useCallback, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  hapticPlay, hapticPause, hapticNavigation,
  updateMediaSession, setMediaSessionHandlers, setMediaSessionPlaybackState,
} from "@/lib/nativeService";

export interface PlayerSong {
  id: string;
  title: string;
  artist: string;
  album?: string;
  coverUrl?: string;
  audioUrl?: string;
  instrumentalUrl?: string;
  lyricsLrc?: string;
  durationSeconds?: number;
}

interface LrcLine {
  time: number;
  text: string;
}

export type RepeatMode = "off" | "all" | "one";

interface PlayerContextType {
  currentSong: PlayerSong | null;
  isPlaying: boolean;
  isKaraoke: boolean;
  isExpanded: boolean;
  progress: number;
  duration: number;
  currentTime: number;
  lrcLines: LrcLine[];
  activeLrcIndex: number;
  repeatMode: RepeatMode;
  shuffleOn: boolean;
  queue: PlayerSong[];
  queueIndex: number;
  volume: number;
  playSong: (song: PlayerSong) => void;
  playQueue: (songs: PlayerSong[], startIndex?: number) => void;
  togglePlay: () => void;
  toggleKaraoke: () => void;
  toggleExpanded: () => void;
  seekTo: (percent: number) => void;
  skipNext: () => void;
  skipPrev: () => void;
  cycleRepeat: () => void;
  toggleShuffle: () => void;
  setVolume: (v: number) => void;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

export const usePlayer = () => {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be inside PlayerProvider");
  return ctx;
};

function toDirectUrl(url?: string): string | undefined {
  if (!url) return undefined;
  const match = url.match(/\/file\/d\/([^/]+)/);
  if (match) return `https://drive.google.com/uc?export=download&id=${match[1]}`;
  return url;
}

export const PlayerProvider = ({ children }: { children: ReactNode }) => {

  const [currentSong, setCurrentSong] = useState<PlayerSong | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isKaraoke, setIsKaraoke] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");
  const [shuffleOn, setShuffleOn] = useState(false);
  const [queue, setQueue] = useState<PlayerSong[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [lrcLines, setLrcLines] = useState<LrcLine[]>([]);
  const [activeLrcIndex, setActiveLrcIndex] = useState(-1);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<number | null>(null);

  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startInterval = useCallback(() => {
    stopInterval();
    intervalRef.current = window.setInterval(() => {
      if (audioRef.current) {
        const ct = audioRef.current.currentTime;
        const dur = audioRef.current.duration || 1;
        setCurrentTime(ct);
        setProgress((ct / dur) * 100);
      }
    }, 200);
  }, [stopInterval]);

  // Parse LRC lyrics
  const parseLrc = useCallback((lrc?: string): LrcLine[] => {
    if (!lrc) return [];
    return lrc.split("\n").map(line => {
      const match = line.match(/\[(\d+):(\d+\.\d+)\](.*)/);
      if (!match) return null;
      return { time: parseInt(match[1]) * 60 + parseFloat(match[2]), text: match[3].trim() };
    }).filter(Boolean) as LrcLine[];
  }, []);

  // Update active lyric index
  useEffect(() => {
    if (lrcLines.length === 0) { setActiveLrcIndex(-1); return; }
    let idx = -1;
    for (let i = 0; i < lrcLines.length; i++) {
      if (currentTime >= lrcLines[i].time) idx = i;
      else break;
    }
    setActiveLrcIndex(idx);
  }, [currentTime, lrcLines]);

  const loadAndPlay = useCallback((song: PlayerSong, karaokeMode?: boolean) => {
    stopInterval();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }

    setCurrentSong(song);
    setLrcLines(parseLrc(song.lyricsLrc));
    const useKaraoke = karaokeMode ?? false;
    setIsKaraoke(useKaraoke);

    const url = toDirectUrl(useKaraoke ? song.instrumentalUrl : song.audioUrl);
    if (!url) return;

    const audio = new Audio(url);
    audio.volume = volume;
    audioRef.current = audio;

    audio.addEventListener("loadedmetadata", () => setDuration(audio.duration));

    updateMediaSession({ title: song.title, artist: song.artist, album: song.album, coverUrl: song.coverUrl });

    if ((window as any).ReactNativeWebView) {
      (window as any).ReactNativeWebView.postMessage(JSON.stringify({ type: "PLAY_SONG", url }));
      setIsPlaying(true);
    } else {
      audio.play().then(() => {
        setIsPlaying(true);
        setMediaSessionPlaybackState("playing");
        startInterval();
      }).catch(() => {});
    }
  }, [startInterval, stopInterval, parseLrc, volume]);

  // We need a ref to access latest queue/repeat state inside the ended callback
  const queueRef = useRef(queue);
  const queueIndexRef = useRef(queueIndex);
  const repeatModeRef = useRef(repeatMode);
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { queueIndexRef.current = queueIndex; }, [queueIndex]);
  useEffect(() => { repeatModeRef.current = repeatMode; }, [repeatMode]);

  // Attach ended handler whenever audio changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => {
      stopInterval();
      const rm = repeatModeRef.current;
      const q = queueRef.current;
      const qi = queueIndexRef.current;
      if (rm === "one") {
        audio.currentTime = 0;
        audio.play().then(() => startInterval()).catch(() => {});
      } else if (q.length > 0) {
        const nextIdx = qi + 1;
        if (nextIdx < q.length) {
          setQueueIndex(nextIdx);
          loadAndPlay(q[nextIdx]);
        } else if (rm === "all") {
          setQueueIndex(0);
          loadAndPlay(q[0]);
        } else {
          setIsPlaying(false);
          setMediaSessionPlaybackState("paused");
        }
      } else {
        setIsPlaying(false);
        setMediaSessionPlaybackState("paused");
      }
    };
    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, [currentSong, stopInterval, startInterval, loadAndPlay]);

  const playQueue = useCallback((songs: PlayerSong[], startIndex = 0) => {
    setQueue(songs);
    setQueueIndex(startIndex);
    if (songs[startIndex]) loadAndPlay(songs[startIndex]);
  }, [loadAndPlay]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      stopInterval();
      hapticPause();
    } else {
      if ((window as any).ReactNativeWebView) {
        (window as any).ReactNativeWebView.postMessage(JSON.stringify({ type: "PLAY_SONG", url: audioRef.current.src }));
      } else {
        audioRef.current.play();
        startInterval();
      }
      hapticPlay();
    }
    setIsPlaying((p) => {
      const next = !p;
      setMediaSessionPlaybackState(next ? "playing" : "paused");
      return next;
    });
  }, [isPlaying, startInterval, stopInterval]);

  const toggleKaraoke = useCallback(() => {
    setIsKaraoke((k) => {
      const next = !k;
      if (audioRef.current && currentSong) {
        const url = toDirectUrl(next ? currentSong.instrumentalUrl : currentSong.audioUrl);
        if (!url) return next;
        if ((window as any).ReactNativeWebView) {
          (window as any).ReactNativeWebView.postMessage(JSON.stringify({ type: "PLAY_SONG", url }));
        } else {
          audioRef.current.pause();
          const audio = new Audio(url);
          audio.volume = volume;
          audioRef.current = audio;
          audio.addEventListener("loadedmetadata", () => {
            setDuration(audio.duration);
            if (isPlaying) audio.play();
          });
        }
      }
      return next;
    });
  }, [currentSong, isPlaying, volume]);

  const toggleExpanded = useCallback(() => setIsExpanded(e => !e), []);

  const seekTo = useCallback((percent: number) => {
    if (!audioRef.current) return;
    const t = (percent / 100) * (audioRef.current.duration || 0);
    audioRef.current.currentTime = t;
    setCurrentTime(t);
    setProgress(percent);
  }, []);

  const skipNext = useCallback(() => {
    if (queue.length === 0) return;
    let nextIdx: number;
    if (shuffleOn) {
      nextIdx = Math.floor(Math.random() * queue.length);
    } else {
      nextIdx = queueIndex + 1;
      if (nextIdx >= queue.length) nextIdx = repeatMode === "all" ? 0 : queueIndex;
    }
    if (nextIdx !== queueIndex || repeatMode === "all") {
      setQueueIndex(nextIdx);
      loadAndPlay(queue[nextIdx]);
      hapticNavigation();
    }
  }, [queue, queueIndex, shuffleOn, repeatMode, loadAndPlay]);

  const skipPrev = useCallback(() => {
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      setProgress(0);
      return;
    }
    if (queue.length === 0) return;
    let prevIdx = queueIndex - 1;
    if (prevIdx < 0) prevIdx = repeatMode === "all" ? queue.length - 1 : 0;
    setQueueIndex(prevIdx);
    loadAndPlay(queue[prevIdx]);
    hapticNavigation();
  }, [queue, queueIndex, repeatMode, loadAndPlay]);

  const cycleRepeat = useCallback(() => {
    setRepeatMode(m => m === "off" ? "all" : m === "all" ? "one" : "off");
  }, []);

  const toggleShuffle = useCallback(() => setShuffleOn(s => !s), []);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    if (audioRef.current) audioRef.current.volume = v;
  }, []);

  // Media session handlers
  useEffect(() => {
    setMediaSessionHandlers({
      onPlay: togglePlay,
      onPause: togglePlay,
      onNext: skipNext,
      onPrev: skipPrev,
    });
  }, [togglePlay, skipNext, skipPrev]);

  return (
    <PlayerContext.Provider value={{
      currentSong, isPlaying, isKaraoke, isExpanded, progress, duration, currentTime,
      lrcLines, activeLrcIndex, repeatMode, shuffleOn, queue, queueIndex, volume,
      playSong: loadAndPlay, playQueue, togglePlay, toggleKaraoke, toggleExpanded,
      seekTo, skipNext, skipPrev, cycleRepeat, toggleShuffle, setVolume,
    }}>
      {children}
    </PlayerContext.Provider>
  );
};