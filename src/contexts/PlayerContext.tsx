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
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

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

  // ✅ MODIFIED: loadAndPlay
  const loadAndPlay = useCallback((song: PlayerSong, karaokeMode?: boolean) => {

    stopInterval();

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    setCurrentSong(song);

    const useKaraoke = karaokeMode ?? false;
    setIsKaraoke(useKaraoke);

    const url = toDirectUrl(useKaraoke ? song.instrumentalUrl : song.audioUrl);

    if (!url) return;

    const audio = new Audio(url);
    audioRef.current = audio;

    audio.addEventListener("loadedmetadata", () => {
      setDuration(audio.duration);
    });

    // 🔥 IMPORTANT CHANGE
    if ((window as any).ReactNativeWebView) {

      (window as any).ReactNativeWebView.postMessage(
        JSON.stringify({
          type: "PLAY_SONG",
          url
        })
      );

      setIsPlaying(true);

    } else {

      audio.play()
        .then(() => {
          setIsPlaying(true);
          startInterval();
        })
        .catch(() => {});

    }

  }, [startInterval, stopInterval]);

  // ✅ MODIFIED: togglePlay
  const togglePlay = useCallback(() => {

    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      stopInterval();
      hapticPause();
    } else {

      if ((window as any).ReactNativeWebView) {

        (window as any).ReactNativeWebView.postMessage(
          JSON.stringify({
            type: "PLAY_SONG",
            url: audioRef.current.src
          })
        );

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

  // ✅ MODIFIED: toggleKaraoke
  const toggleKaraoke = useCallback(() => {

    setIsKaraoke((k) => {

      const next = !k;

      if (audioRef.current && currentSong) {

        const url = toDirectUrl(
          next ? currentSong.instrumentalUrl : currentSong.audioUrl
        );

        if (!url) return next;

        if ((window as any).ReactNativeWebView) {

          (window as any).ReactNativeWebView.postMessage(
            JSON.stringify({
              type: "PLAY_SONG",
              url
            })
          );

        } else {

          audioRef.current.pause();
          const audio = new Audio(url);
          audioRef.current = audio;

          audio.addEventListener("loadedmetadata", () => {
            setDuration(audio.duration);
            if (isPlaying) audio.play();
          });

        }
      }

      return next;

    });

  }, [currentSong, isPlaying]);

  return (
    <PlayerContext.Provider value={{
      currentSong,
      isPlaying,
      isKaraoke,
      progress,
      duration,
      currentTime,
      playSong: loadAndPlay,
      playQueue: () => {},
      togglePlay,
      toggleKaraoke,
      toggleExpanded: () => {},
      seekTo: () => {},
      skipNext: () => {},
      skipPrev: () => {},
      cycleRepeat: () => {},
      toggleShuffle: () => {},
      setVolume: () => {},
      repeatMode: "off",
      shuffleOn: false,
      queue: [],
      queueIndex: 0,
      volume: 1,
      isExpanded: false,
      lrcLines: [],
      activeLrcIndex: -1,
    }}>
      {children}
    </PlayerContext.Provider>
  );
};