import { createContext, useContext, useState, useRef, useCallback, ReactNode } from "react";

export interface PlayerSong {
  id: string;
  title: string;
  artist: string;
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
  playSong: (song: PlayerSong) => void;
  togglePlay: () => void;
  toggleKaraoke: () => void;
  toggleExpanded: () => void;
  seekTo: (percent: number) => void;
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
        // Update active lyric
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

  const playSong = useCallback((song: PlayerSong) => {
    stopInterval();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setCurrentSong(song);
    setIsKaraoke(false);
    setProgress(0);
    setCurrentTime(0);
    setActiveLrcIndex(-1);

    if (song.lyricsLrc) {
      setLrcLines(parseLrc(song.lyricsLrc));
    } else {
      setLrcLines([]);
    }

    const url = song.audioUrl;
    if (url) {
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.addEventListener("loadedmetadata", () => setDuration(audio.duration));
      audio.addEventListener("ended", () => { setIsPlaying(false); stopInterval(); });
      audio.play().then(() => { setIsPlaying(true); startInterval(); }).catch(() => {});
    } else {
      // Mock: simulate with duration
      setDuration(song.durationSeconds || 240);
      setIsPlaying(true);
      startInterval();
    }
  }, [startInterval, stopInterval]);

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
        const url = next ? currentSong.instrumentalUrl : currentSong.audioUrl;
        if (url) {
          const audio = new Audio(url);
          audioRef.current = audio;
          audio.addEventListener("loadedmetadata", () => {
            audio.currentTime = ct;
            setDuration(audio.duration);
            if (isPlaying) audio.play();
          });
          audio.addEventListener("ended", () => { setIsPlaying(false); stopInterval(); });
        }
      }
      return next;
    });
  }, [currentSong, isPlaying, stopInterval]);

  const toggleExpanded = useCallback(() => setIsExpanded((e) => !e), []);

  const seekTo = useCallback((percent: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = (percent / 100) * (audioRef.current.duration || 1);
    }
    setProgress(percent);
  }, []);

  return (
    <PlayerContext.Provider value={{
      currentSong, isPlaying, isKaraoke, isExpanded, progress, duration,
      currentTime, lrcLines, activeLrcIndex, playSong, togglePlay,
      toggleKaraoke, toggleExpanded, seekTo,
    }}>
      {children}
    </PlayerContext.Provider>
  );
};
