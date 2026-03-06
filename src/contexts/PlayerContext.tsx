import { createContext, useContext, useState, useRef, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

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
  trackEndCount: number;
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

function parseLrc(lrc: string): LrcLine[] {
  const lines: LrcLine[] = [];
  const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;
  lrc.split("\n").forEach((line) => {
    const match = regex.exec(line);
    if (match) {
      const min = parseInt(match[1]);
      const sec = parseInt(match[2]);
      const ms = parseInt(match[3].padEnd(3, "0"));
      lines.push({ time: min * 60 + sec + ms / 1000, text: match[4].trim() });
    }
  });
  return lines.sort((a, b) => a.time - b.time);
}

// Convert Google Drive view links to direct streamable URLs
function toDirectUrl(url?: string): string | undefined {
  if (!url) return undefined;
  const match = url.match(/\/file\/d\/([^/]+)/);
  if (match) return `https://drive.google.com/uc?export=download&id=${match[1]}`;
  return url;
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const PlayerProvider = ({ children }: { children: ReactNode }) => {
  const [currentSong, setCurrentSong] = useState<PlayerSong | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isKaraoke, setIsKaraoke] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [lrcLines, setLrcLines] = useState<LrcLine[]>([]);
  const [activeLrcIndex, setActiveLrcIndex] = useState(-1);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");
  const [shuffleOn, setShuffleOn] = useState(false);
  const [queue, setQueue] = useState<PlayerSong[]>([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<number | null>(null);
  const [volume, setVolumeState] = useState(0.7);
  const [trackEndCount, setTrackEndCount] = useState(0);

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
        setLrcLines((lines) => {
          let idx = -1;
          for (let i = lines.length - 1; i >= 0; i--) {
            if (ct >= lines[i].time) { idx = i; break; }
          }
          setActiveLrcIndex(idx);
          return lines;
        });
      }
    }, 200);
  }, [stopInterval]);

  const loadAndPlay = useCallback((song: PlayerSong, karaokeMode?: boolean) => {
    stopInterval();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setCurrentSong(song);
    const useKaraoke = karaokeMode ?? false;
    setIsKaraoke(useKaraoke);
    setProgress(0);
    setCurrentTime(0);
    setActiveLrcIndex(-1);

    if (song.lyricsLrc) {
      setLrcLines(parseLrc(song.lyricsLrc));
    } else {
      setLrcLines([]);
    }

    const url = toDirectUrl(useKaraoke ? song.instrumentalUrl : song.audioUrl);
    if (url) {
      const audio = new Audio(url);
      audio.volume = volume;
      audioRef.current = audio;
      audio.addEventListener("loadedmetadata", () => setDuration(audio.duration));
      audio.play().then(() => { setIsPlaying(true); startInterval(); }).catch(() => {});
    } else {
      setDuration(song.durationSeconds || 240);
      setIsPlaying(true);
      startInterval();
    }

    // MediaSession API for lock-screen / background controls
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.title,
        artist: song.artist,
        album: song.album || "",
        artwork: song.coverUrl ? [{ src: song.coverUrl, sizes: "512x512", type: "image/jpeg" }] : [],
      });
      navigator.mediaSession.setActionHandler("play", () => {
        audioRef.current?.play();
        setIsPlaying(true);
        startInterval();
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        audioRef.current?.pause();
        setIsPlaying(false);
        stopInterval();
      });
      navigator.mediaSession.setActionHandler("previoustrack", () => skipPrevRef.current());
      navigator.mediaSession.setActionHandler("nexttrack", () => skipNextRef.current());
    }
  }, [startInterval, stopInterval]);

  // Handle song ended — needs access to latest state via refs
  const repeatModeRef = useRef(repeatMode);
  repeatModeRef.current = repeatMode;
  const shuffleOnRef = useRef(shuffleOn);
  shuffleOnRef.current = shuffleOn;
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const queueIndexRef = useRef(queueIndex);
  queueIndexRef.current = queueIndex;
  const skipNextRef = useRef(() => {});
  const skipPrevRef = useRef(() => {});

  const handleEnded = useCallback(() => {
    const rm = repeatModeRef.current;
    const q = queueRef.current;
    const qi = queueIndexRef.current;

    setTrackEndCount(c => c + 1);

    if (rm === "one") {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
      return;
    }

    if (q.length > 0 && qi >= 0) {
      let nextIdx = qi + 1;
      if (nextIdx >= q.length) {
        if (rm === "all") {
          nextIdx = 0;
        } else {
          setIsPlaying(false);
          stopInterval();
          return;
        }
      }
      setQueueIndex(nextIdx);
      loadAndPlay(q[nextIdx]);
    } else {
      setIsPlaying(false);
      stopInterval();
    }
  }, [loadAndPlay, stopInterval]);

  // Attach ended listener whenever audio changes
  const attachEndedListener = useCallback((audio: HTMLAudioElement) => {
    audio.addEventListener("ended", handleEnded);
  }, [handleEnded]);

  const recordPlay = useCallback(async (songId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await supabase.from("recently_played").insert({ user_id: session.user.id, song_id: songId });
      }
    } catch {}
  }, []);

  const playSong = useCallback((song: PlayerSong) => {
    setQueue([song]);
    setQueueIndex(0);
    loadAndPlay(song);
    recordPlay(song.id);
    setTimeout(() => {
      if (audioRef.current) attachEndedListener(audioRef.current);
    }, 0);
  }, [loadAndPlay, attachEndedListener, recordPlay]);

  const playQueue = useCallback((songs: PlayerSong[], startIndex = 0) => {
    const q = shuffleOnRef.current ? shuffleArray(songs) : songs;
    setQueue(q);
    setQueueIndex(startIndex);
    if (q[startIndex]) {
      loadAndPlay(q[startIndex]);
      recordPlay(q[startIndex].id);
      setTimeout(() => {
        if (audioRef.current) attachEndedListener(audioRef.current);
      }, 0);
    }
  }, [loadAndPlay, attachEndedListener, recordPlay]);

  const skipNext = useCallback(() => {
    if (queue.length === 0) return;
    let nextIdx = queueIndex + 1;
    if (nextIdx >= queue.length) {
      if (repeatMode === "all") nextIdx = 0;
      else return;
    }
    setQueueIndex(nextIdx);
    loadAndPlay(queue[nextIdx]);
    setTimeout(() => {
      if (audioRef.current) attachEndedListener(audioRef.current);
    }, 0);
  }, [queue, queueIndex, repeatMode, loadAndPlay, attachEndedListener]);

  const skipPrev = useCallback(() => {
    if (queue.length === 0) return;
    // If > 3s in, restart; otherwise go previous
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }
    let prevIdx = queueIndex - 1;
    if (prevIdx < 0) {
      if (repeatMode === "all") prevIdx = queue.length - 1;
      else { if (audioRef.current) audioRef.current.currentTime = 0; return; }
    }
    setQueueIndex(prevIdx);
    loadAndPlay(queue[prevIdx]);
    setTimeout(() => {
      if (audioRef.current) attachEndedListener(audioRef.current);
    }, 0);
  }, [queue, queueIndex, repeatMode, loadAndPlay, attachEndedListener]);

  const togglePlay = useCallback(() => {
    if (audioRef.current) {
      if (isPlaying) { audioRef.current.pause(); stopInterval(); }
      else { audioRef.current.play(); startInterval(); }
    }
    setIsPlaying((p) => !p);
  }, [isPlaying, startInterval, stopInterval]);

  const toggleKaraoke = useCallback(() => {
    setIsKaraoke((k) => {
      const next = !k;
      if (audioRef.current && currentSong) {
        const ct = audioRef.current.currentTime;
        audioRef.current.pause();
        const url = toDirectUrl(next ? currentSong.instrumentalUrl : currentSong.audioUrl);
        if (url) {
          const audio = new Audio(url);
          audioRef.current = audio;
          audio.addEventListener("loadedmetadata", () => {
            audio.currentTime = ct;
            setDuration(audio.duration);
            if (isPlaying) audio.play();
          });
          attachEndedListener(audio);
        }
      }
      return next;
    });
  }, [currentSong, isPlaying, attachEndedListener]);

  const toggleExpanded = useCallback(() => setIsExpanded((e) => !e), []);

  const seekTo = useCallback((percent: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = (percent / 100) * (audioRef.current.duration || 1);
    }
    setProgress(percent);
  }, []);

  const cycleRepeat = useCallback(() => {
    setRepeatMode((m) => m === "off" ? "all" : m === "all" ? "one" : "off");
  }, []);

  const toggleShuffle = useCallback(() => {
    setShuffleOn((s) => !s);
  }, []);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    if (audioRef.current) audioRef.current.volume = v;
  }, []);

  return (
    <PlayerContext.Provider value={{
      currentSong, isPlaying, isKaraoke, isExpanded, progress, duration,
      currentTime, lrcLines, activeLrcIndex, repeatMode, shuffleOn,
      queue, queueIndex, volume, trackEndCount, playSong, playQueue, togglePlay,
      toggleKaraoke, toggleExpanded, seekTo, skipNext, skipPrev,
      cycleRepeat, toggleShuffle, setVolume,
    }}>
      {children}
    </PlayerContext.Provider>
  );
};