import { createContext, useContext, useState, useRef, useCallback, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface PlayerSong {
  id: string;
  title: string;
  artist: string;
  album?: string;
  coverUrl?: string;
  audioUrl?: string;
  instrumentalUrl?: string;
  lyricsLrc?: string;
  lyricsText?: string;
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
  staticLyrics: string;
  activeLrcIndex: number;
  repeatMode: RepeatMode;
  shuffleOn: boolean;
  queue: PlayerSong[];
  queueIndex: number;
  volume: number;
  trackEndCount: number;
  playSong: (song: PlayerSong) => void;
  playQueue: (songs: PlayerSong[], startIndex?: number) => void;
  playVideo: (song: PlayerSong) => void;
  videoModeRequest: boolean;
  clearVideoModeRequest: () => void;
  singThis: (song: PlayerSong) => void;
  karaokeModeRequest: boolean;
  clearKaraokeModeRequest: () => void;
  togglePlay: () => void;
  toggleKaraoke: () => void;
  toggleExpanded: () => void;
  seekTo: (percent: number) => void;
  skipNext: () => void;
  skipPrev: () => void;
  cycleRepeat: () => void;
  toggleShuffle: () => void;
  setVolume: (v: number) => void;
  applyLyrics: (lrc?: string | null, text?: string | null) => void;
  handoffPause: () => number;
  resumeAt: (seconds: number) => void;
}

// Keep one context instance across hot reloads so consumers and provider never mismatch.
const globalCtx = globalThis as unknown as { __loveworldPlayerContext?: import("react").Context<PlayerContextType | null> };
const PlayerContext =
  globalCtx.__loveworldPlayerContext ??
  (globalCtx.__loveworldPlayerContext = createContext<PlayerContextType | null>(null));

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

const AUTO_PAUSE_MS = 60 * 60 * 1000; // 1 hour
const PLAYER_STATE_KEY = "loveworld-player-state-v1";
const PLAYER_STATE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

type PersistedPlayerState = {
  song: PlayerSong;
  queue: PlayerSong[];
  queueIndex: number;
  currentTime: number;
  isKaraoke: boolean;
  repeatMode: RepeatMode;
  shuffleOn: boolean;
  volume: number;
  savedAt: number;
};

// Only one player audio may ever sound at once: any audio starting playback pauses all others.
const playerAudios: Set<HTMLAudioElement> = ((globalThis as any).__lwPlayerAudios ??= new Set<HTMLAudioElement>());
function createExclusiveAudio(url: string): HTMLAudioElement {
  const audio = new Audio(url);
  playerAudios.add(audio);
  audio.addEventListener("play", () => {
    playerAudios.forEach((other) => { if (other !== audio && !other.paused) other.pause(); });
    // drop stale references so they can be garbage collected
    playerAudios.forEach((other) => { if (other !== audio && other.paused) playerAudios.delete(other); });
    playerAudios.add(audio);
  });
  return audio;
}

export const PlayerProvider = ({ children }: { children: ReactNode }) => {
  const [currentSong, setCurrentSong] = useState<PlayerSong | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isKaraoke, setIsKaraoke] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [videoModeRequest, setVideoModeRequest] = useState(false);
  const [karaokeModeRequest, setKaraokeModeRequest] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [lrcLines, setLrcLines] = useState<LrcLine[]>([]);
  const [staticLyrics, setStaticLyrics] = useState<string>("");
  const [activeLrcIndex, setActiveLrcIndex] = useState(-1);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");
  const [shuffleOn, setShuffleOn] = useState(false);
  const [queue, setQueue] = useState<PlayerSong[]>([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<number | null>(null);
  const [volume, setVolumeState] = useState(0.7);
  const [trackEndCount, setTrackEndCount] = useState(0);
  const [showStillThere, setShowStillThere] = useState(false);
  const autoPauseTimerRef = useRef<number | null>(null);
  const playStartTimeRef = useRef<number>(Date.now());

  // Refs for latest state (used in ended handler)
  const repeatModeRef = useRef(repeatMode);
  repeatModeRef.current = repeatMode;
  const shuffleOnRef = useRef(shuffleOn);
  shuffleOnRef.current = shuffleOn;
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const queueIndexRef = useRef(queueIndex);
  queueIndexRef.current = queueIndex;
  const volumeRef = useRef(volume);
  volumeRef.current = volume;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const internalPlayRef = useRef<(song: PlayerSong, karaokeMode: boolean, startAt?: number, autoplay?: boolean) => void>(() => {});
  const restoredRef = useRef(false);
  const lastPersistRef = useRef(0);

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

  // Auto-pause timer management
  const resetAutoPauseTimer = useCallback(() => {
    if (autoPauseTimerRef.current) clearTimeout(autoPauseTimerRef.current);
    playStartTimeRef.current = Date.now();
    autoPauseTimerRef.current = window.setTimeout(() => {
      // Only pause if repeat is on (continuous playback)
      if (repeatModeRef.current === "all" && audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
        stopInterval();
        setShowStillThere(true);
      }
    }, AUTO_PAUSE_MS);
  }, [stopInterval]);

  const clearAutoPauseTimer = useCallback(() => {
    if (autoPauseTimerRef.current) {
      clearTimeout(autoPauseTimerRef.current);
      autoPauseTimerRef.current = null;
    }
  }, []);

  // The core function that creates an audio, plays it, and attaches ended handler
  const internalPlay = useCallback((song: PlayerSong, karaokeMode: boolean, startAt = 0, autoplay = true) => {
    stopInterval();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current = null;
    }
    setCurrentSong(song);
    setIsKaraoke(karaokeMode);
    setProgress(song.durationSeconds ? (startAt / song.durationSeconds) * 100 : 0);
    setCurrentTime(startAt);
    setActiveLrcIndex(-1);

    if (song.lyricsLrc) {
      const parsed = parseLrc(song.lyricsLrc);
      setLrcLines(parsed);
      // If LRC text has no timestamps, treat its raw content as static fallback
      if (parsed.length === 0) {
        setStaticLyrics(song.lyricsText || song.lyricsLrc);
      } else {
        setStaticLyrics(song.lyricsText || "");
      }
    } else {
      setLrcLines([]);
      setStaticLyrics(song.lyricsText || "");
    }

    // Fetch static lyrics fallback from DB if missing
    if (!song.lyricsText) {
      supabase.from("songs").select("lyrics_text").eq("id", song.id).maybeSingle().then(({ data }: any) => {
        if (data?.lyrics_text) {
          setStaticLyrics((prev) => prev || data.lyrics_text);
        }
      });
    }

    const url = toDirectUrl(karaokeMode ? song.instrumentalUrl : song.audioUrl);
    if (url) {
      const audio = createExclusiveAudio(url);
      audio.volume = volumeRef.current;
      audioRef.current = audio;
      
      audio.onended = () => {
        const rm = repeatModeRef.current;
        const q = queueRef.current;
        const qi = queueIndexRef.current;

        setTrackEndCount(c => c + 1);

        if (rm === "one") {
          audio.currentTime = 0;
          audio.play().catch(() => {});
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
              clearAutoPauseTimer();
              return;
            }
          }
          setQueueIndex(nextIdx);
          internalPlayRef.current(q[nextIdx], karaokeMode);
          recordPlayFn(q[nextIdx].id);
        } else {
          // No queue but repeat off — still try next sequential track
          setIsPlaying(false);
          stopInterval();
          clearAutoPauseTimer();
        }
      };

      audio.addEventListener("loadedmetadata", () => {
        setDuration(audio.duration);
        if (startAt > 0 && startAt < audio.duration) audio.currentTime = startAt;
      });
      if (autoplay) {
        audio.play().then(() => { setIsPlaying(true); startInterval(); resetAutoPauseTimer(); }).catch(() => {});
      } else {
        setIsPlaying(false);
      }
    } else {
      setDuration(song.durationSeconds || 240);
      setIsPlaying(true);
      startInterval();
    }

    // MediaSession API
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
  }, [startInterval, stopInterval, resetAutoPauseTimer, clearAutoPauseTimer]);

  internalPlayRef.current = internalPlay;

  // Restore the last listening session once. Browsers require a user gesture before
  // audio can resume, so the track returns paused at the saved position.
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    try {
      const raw = localStorage.getItem(PLAYER_STATE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as PersistedPlayerState;
      const isExpired = !saved.savedAt || Date.now() - saved.savedAt > PLAYER_STATE_MAX_AGE;
      const isComplete = !!saved.song?.durationSeconds && saved.currentTime >= saved.song.durationSeconds - 2;
      if (!saved.song?.id || !saved.song.audioUrl || isExpired || isComplete) {
        localStorage.removeItem(PLAYER_STATE_KEY);
        return;
      }
      const restoredQueue = Array.isArray(saved.queue) && saved.queue.length ? saved.queue : [saved.song];
      const restoredIndex = Math.max(0, Math.min(saved.queueIndex ?? 0, restoredQueue.length - 1));
      setQueue(restoredQueue);
      setQueueIndex(restoredIndex);
      setRepeatMode(saved.repeatMode || "off");
      setShuffleOn(!!saved.shuffleOn);
      setVolumeState(Math.max(0, Math.min(saved.volume ?? 0.7, 1)));
      volumeRef.current = Math.max(0, Math.min(saved.volume ?? 0.7, 1));
      internalPlay(restoredQueue[restoredIndex] || saved.song, !!saved.isKaraoke, Math.max(0, saved.currentTime || 0), false);
    } catch {
      localStorage.removeItem(PLAYER_STATE_KEY);
    }
  }, [internalPlay]);

  const persistPlayerState = useCallback(() => {
    const song = currentSong;
    if (!song) return;
    const exactTime = audioRef.current?.currentTime ?? currentTime;
    const state: PersistedPlayerState = {
      song, queue: queue.length ? queue : [song], queueIndex: Math.max(0, queueIndex),
      currentTime: exactTime, isKaraoke, repeatMode, shuffleOn, volume, savedAt: Date.now(),
    };
    localStorage.setItem(PLAYER_STATE_KEY, JSON.stringify(state));
  }, [currentSong, currentTime, isKaraoke, queue, queueIndex, repeatMode, shuffleOn, volume]);

  useEffect(() => {
    if (!currentSong) return;
    const now = Date.now();
    if (now - lastPersistRef.current >= 2000 || !isPlaying) {
      lastPersistRef.current = now;
      persistPlayerState();
    }
  }, [currentSong, currentTime, isPlaying, isKaraoke, queue, queueIndex, repeatMode, shuffleOn, volume, persistPlayerState]);

  useEffect(() => {
    const save = () => persistPlayerState();
    window.addEventListener("pagehide", save);
    return () => window.removeEventListener("pagehide", save);
  }, [persistPlayerState]);

  const skipNextRef = useRef(() => {});
  const skipPrevRef = useRef(() => {});

  const recordPlayFn = useCallback(async (songId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { error } = await supabase.from("recently_played").insert({ user_id: session.user.id, song_id: songId });
        await supabase.rpc("record_play", { p_song_id: songId, p_mode: "song" });
        if (!error) window.dispatchEvent(new CustomEvent("recently-played-updated"));
      }
    } catch {}
  }, []);

  /** Phase 10: resolve the listener's preferred lyrics language before playback —
   *  swap in a ready audio version recorded in that language and its lyrics. */
  const resolvePreferred = useCallback(async (song: PlayerSong): Promise<PlayerSong> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return song;
      const { data: prefs } = await supabase.from("user_preferences").select("preferred_languages").eq("user_id", user.id).maybeSingle();
      const pref = (prefs as { preferred_languages?: string[] } | null)?.preferred_languages?.[0];
      if (!pref || pref === "en") return song;
      const [ver, lyr] = await Promise.all([
        supabase.from("song_audio_versions").select("audio_url").eq("song_id", song.id).eq("kind", "full").eq("status", "ready").eq("language_code", pref).maybeSingle(),
        supabase.from("song_lyrics").select("lyrics_lrc, lyrics_text").eq("song_id", song.id).eq("language_code", pref).maybeSingle(),
      ]);
      return {
        ...song,
        audioUrl: (ver.data as { audio_url: string } | null)?.audio_url || song.audioUrl,
        lyricsLrc: (lyr.data as { lyrics_lrc: string | null } | null)?.lyrics_lrc ?? song.lyricsLrc,
        lyricsText: (lyr.data as { lyrics_text: string | null } | null)?.lyrics_text ?? song.lyricsText,
      };
    } catch {
      return song;
    }
  }, []);

  const playSong = useCallback((song: PlayerSong) => {
    setQueue([song]);
    setQueueIndex(0);
    resolvePreferred(song).then((s) => {
      internalPlay(s, false);
      recordPlayFn(s.id);
    });
  }, [internalPlay, recordPlayFn, resolvePreferred]);

  const playVideo = useCallback((song: PlayerSong) => {
    playSong(song);
    setIsExpanded(true);
    setVideoModeRequest(true);
  }, [playSong]);

  const clearVideoModeRequest = useCallback(() => setVideoModeRequest(false), []);

  const singThis = useCallback((song: PlayerSong) => {
    playSong(song);
    setIsExpanded(true);
    setKaraokeModeRequest(true);
  }, [playSong]);

  const clearKaraokeModeRequest = useCallback(() => setKaraokeModeRequest(false), []);

  const playQueue = useCallback((songs: PlayerSong[], startIndex = 0) => {
    const q = shuffleOnRef.current ? shuffleArray(songs) : songs;
    setQueue(q);
    setQueueIndex(startIndex);
    if (q[startIndex]) {
      resolvePreferred(q[startIndex]).then((s) => {
        internalPlay(s, false);
        recordPlayFn(s.id);
      });
    }
  }, [internalPlay, recordPlayFn, resolvePreferred]);

  const skipNext = useCallback(() => {
    if (queue.length === 0) return;
    let nextIdx = queueIndex + 1;
    if (nextIdx >= queue.length) {
      if (repeatMode === "all") nextIdx = 0;
      else return;
    }
    setQueueIndex(nextIdx);
    internalPlay(queue[nextIdx], isKaraoke);
    recordPlayFn(queue[nextIdx].id);
  }, [queue, queueIndex, repeatMode, isKaraoke, internalPlay, recordPlayFn]);

  const skipPrev = useCallback(() => {
    if (queue.length === 0) return;
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
    internalPlay(queue[prevIdx], isKaraoke);
    recordPlayFn(queue[prevIdx].id);
  }, [queue, queueIndex, repeatMode, isKaraoke, internalPlay, recordPlayFn]);

  skipNextRef.current = skipNext;
  skipPrevRef.current = skipPrev;

  const togglePlay = useCallback(() => {
    if (audioRef.current) {
      if (isPlaying) { audioRef.current.pause(); stopInterval(); clearAutoPauseTimer(); }
      else { audioRef.current.play(); startInterval(); resetAutoPauseTimer(); }
    }
    setIsPlaying((p) => !p);
  }, [isPlaying, startInterval, stopInterval, resetAutoPauseTimer, clearAutoPauseTimer]);

  const toggleKaraoke = useCallback(() => {
    {
      const next = !isKaraokeRef.current;
      isKaraokeRef.current = next;
      if (audioRef.current && currentSong) {
        const ct = audioRef.current.currentTime;
        audioRef.current.pause();
        audioRef.current.onended = null;
        const url = toDirectUrl(next ? currentSong.instrumentalUrl : currentSong.audioUrl);
        if (url) {
          const audio = createExclusiveAudio(url);
          audio.volume = volumeRef.current;
          audioRef.current = audio;
          audio.addEventListener("loadedmetadata", () => {
            audio.currentTime = ct;
            setDuration(audio.duration);
            if (isPlayingRef.current) audio.play();
          });
          // Re-attach ended handler
          audio.onended = () => {
            const rm = repeatModeRef.current;
            const q = queueRef.current;
            const qi = queueIndexRef.current;
            setTrackEndCount(c => c + 1);
            if (rm === "one") { audio.currentTime = 0; audio.play().catch(() => {}); return; }
            if (q.length > 0 && qi >= 0) {
              let nextIdx = qi + 1;
              if (nextIdx >= q.length) { if (rm === "all") nextIdx = 0; else { setIsPlaying(false); stopInterval(); return; } }
              setQueueIndex(nextIdx);
              internalPlayRef.current(q[nextIdx], next);
              recordPlayFn(q[nextIdx].id);
            } else { setIsPlaying(false); stopInterval(); }
          };
        }
      }
      setIsKaraoke(next);
    }
  }, [currentSong, internalPlay, stopInterval, recordPlayFn]);

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

  const handleContinuePlaying = useCallback(() => {
    setShowStillThere(false);
    if (audioRef.current) {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        startInterval();
        resetAutoPauseTimer();
      }).catch(() => {});
    }
  }, [startInterval, resetAutoPauseTimer]);

  const applyLyrics = useCallback((lrc?: string | null, text?: string | null) => {
    const parsed = lrc ? parseLrc(lrc) : [];
    setLrcLines(parsed);
    setStaticLyrics(text || (parsed.length ? "" : lrc || ""));
    setActiveLrcIndex(-1);
  }, []);

  const handoffPause = useCallback((): number => {
    const a = audioRef.current;
    if (!a) return 0;
    a.pause();
    stopInterval();
    setIsPlaying(false);
    return a.currentTime;
  }, [stopInterval]);

  const resumeAt = useCallback((seconds: number) => {
    const a = audioRef.current;
    if (!a) return;
    try { a.currentTime = Math.max(0, seconds); } catch {}
    a.play().then(() => { setIsPlaying(true); startInterval(); resetAutoPauseTimer(); }).catch(() => {});
  }, [startInterval, resetAutoPauseTimer]);

  return (
    <PlayerContext.Provider value={{
      currentSong, isPlaying, isKaraoke, isExpanded, progress, duration,
      currentTime, lrcLines, staticLyrics, activeLrcIndex, repeatMode, shuffleOn,
      queue, queueIndex, volume, trackEndCount, playSong, playQueue, togglePlay,
      playVideo, videoModeRequest, clearVideoModeRequest,
      singThis, karaokeModeRequest, clearKaraokeModeRequest,
      toggleKaraoke, toggleExpanded, seekTo, skipNext, skipPrev,
      cycleRepeat, toggleShuffle, setVolume, applyLyrics, handoffPause, resumeAt,
    }}>
      {children}
      {/* "Are you still there?" dialog */}
      {showStillThere && (
        <Dialog open={showStillThere} onOpenChange={(open) => { if (!open) setShowStillThere(false); }}>
          <DialogContent className="max-w-sm text-center">
            <div className="flex flex-col items-center gap-4 py-4">
              <h3 className="text-xl font-serif font-bold text-foreground">Are you still listening?</h3>
              <p className="text-sm text-muted-foreground">Playback was paused after 1 hour of continuous play.</p>
              <Button className="gradient-gold text-primary-foreground w-full" onClick={handleContinuePlaying}>
                Continue Playing
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </PlayerContext.Provider>
  );
};