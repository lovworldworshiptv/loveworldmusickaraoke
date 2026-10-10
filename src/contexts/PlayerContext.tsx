import { useFeatures } from "@/contexts/FeatureContext";
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
  playQueue: (songs: PlayerSong[], startIndex?: number, opts?: { karaoke?: boolean }) => void;
  playVideo: (song: PlayerSong) => void;
  /** Play a queue that stays in Video mode, advancing when each video ends. */
  playVideoQueue: (songs: PlayerSong[], startIndex?: number) => void;
  requestVideoMode: () => void;
  videoModeRequest: boolean;
  clearVideoModeRequest: () => void;
  singThis: (song: PlayerSong) => void;
  karaokeModeRequest: boolean;
  clearKaraokeModeRequest: () => void;
  togglePlay: () => void;
  toggleKaraoke: () => void;
  toggleExpanded: () => void;
  seekTo: (percent: number) => void;
  /** Pass { autoplay: false } to load the next track paused (e.g. before handing off to Video mode). */
  skipNext: (opts?: { autoplay?: boolean } | unknown) => void;
  /** True while the current track is waiting on the network. */
  isBuffering: boolean;
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

/** Playable source for a mode; Karaoke falls back to the full track when no instrumental exists. */
function sourceFor(song: PlayerSong, karaoke: boolean): string | undefined {
  return toDirectUrl((karaoke && song.instrumentalUrl) || song.audioUrl);
}

/** Next queue position with a playable source, honouring repeat-all wrap-around; -1 when the queue is done. */
function findNextIndex(q: PlayerSong[], from: number, repeat: RepeatMode): number {
  for (let step = 1; step <= q.length; step++) {
    const raw = from + step;
    if (raw >= q.length && repeat !== "all") return -1;
    const i = raw % q.length;
    if (q[i] && (q[i].audioUrl || q[i].instrumentalUrl)) return i;
  }
  return -1;
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
  const { enabled } = useFeatures();
  const featuresRef = useRef(enabled);
  featuresRef.current = enabled;
  const [currentSong, setCurrentSong] = useState<PlayerSong | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isKaraoke, setIsKaraoke] = useState(false);
  const isKaraokeRef = useRef(false);
  useEffect(() => { isKaraokeRef.current = isKaraoke; }, [isKaraoke]);
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

  // --- Slow-network resilience: next-track preloading, stall recovery, resolved-song cache ---
  const preloadRef = useRef<{ url: string; audio: HTMLAudioElement } | null>(null);
  const resolvedCacheRef = useRef<Map<string, PlayerSong>>(new Map());
  const resolvePreferredRef = useRef<(song: PlayerSong) => Promise<PlayerSong>>(async (s) => s);
  const advanceToRef = useRef<(idx: number, karaoke: boolean, autoplay?: boolean) => void>(() => {});
  const wantPlayingRef = useRef(false);
  const [isBuffering, setIsBuffering] = useState(false);

  const discardPreload = useCallback((keepUrl?: string) => {
    const p = preloadRef.current;
    if (!p || p.url === keepUrl) return;
    p.audio.removeAttribute("src");
    try { p.audio.load(); } catch {}
    playerAudios.delete(p.audio);
    preloadRef.current = null;
  }, []);

  /** Warm the next queued track (resolved language + audio bytes) so the hand-off is instant. */
  const prefetchNext = useCallback((karaokeMode: boolean) => {
    const q = queueRef.current;
    const idx = findNextIndex(q, queueIndexRef.current, repeatModeRef.current);
    if (idx < 0 || idx === queueIndexRef.current) return;
    const base = q[idx];
    const cached = resolvedCacheRef.current.get(base.id);
    const run = (song: PlayerSong) => {
      const url = sourceFor(song, karaokeMode);
      if (!url || preloadRef.current?.url === url || audioRef.current?.src === url) return;
      discardPreload();
      const audio = new Audio();
      audio.preload = "auto";
      audio.src = url;
      try { audio.load(); } catch {}
      preloadRef.current = { url, audio };
    };
    if (cached) run(cached);
    else resolvePreferredRef.current(base).then((s) => { resolvedCacheRef.current.set(base.id, s); run(s); });
  }, [discardPreload]);

  // The core function that creates an audio, plays it, and attaches ended handler
  const internalPlay = useCallback((song: PlayerSong, karaokeMode: boolean, startAt = 0, autoplay = true) => {
    karaokeMode = karaokeMode && featuresRef.current("karaoke");
    stopInterval();
    if (audioRef.current) {
      const old = audioRef.current;
      old.pause();
      old.onended = null;
      old.onerror = null;
      audioRef.current = null;
    }
    wantPlayingRef.current = autoplay;
    setIsBuffering(false);
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

    const url = sourceFor(song, karaokeMode);
    if (url) {
      // Reuse the warmed-up element for this track when available (already buffered).
      let audio: HTMLAudioElement;
      if (preloadRef.current?.url === url) {
        audio = preloadRef.current.audio;
        preloadRef.current = null;
        playerAudios.add(audio);
        audio.addEventListener("play", () => {
          playerAudios.forEach((other) => { if (other !== audio && !other.paused) other.pause(); });
        });
      } else {
        discardPreload();
        audio = createExclusiveAudio(url);
        audio.preload = "auto";
      }
      audio.volume = volumeRef.current;
      audioRef.current = audio;
      const isCurrent = () => audioRef.current === audio;
      let seekOnLoad = startAt;
      let retries = 0;
      let stallTimer: number | null = null;
      let prefetched = false;
      const clearStall = () => { if (stallTimer) { clearTimeout(stallTimer); stallTimer = null; } };

      const goNext = () => {
        const idx = findNextIndex(queueRef.current, queueIndexRef.current, repeatModeRef.current);
        if (idx >= 0 && idx !== queueIndexRef.current) advanceToRef.current(idx, karaokeMode, true);
        else { setIsPlaying(false); stopInterval(); clearAutoPauseTimer(); }
      };

      // Re-request the stream from where it stopped (network drop / long stall).
      const reconnect = () => {
        if (!isCurrent()) return;
        seekOnLoad = audio.currentTime || seekOnLoad;
        try { audio.load(); } catch {}
        if (wantPlayingRef.current) audio.play().catch(() => {});
      };

      audio.onended = () => {
        clearStall();
        if (!isCurrent()) return;
        setTrackEndCount(c => c + 1);
        if (repeatModeRef.current === "one") {
          audio.currentTime = 0;
          audio.play().catch(() => {});
          return;
        }
        const idx = findNextIndex(queueRef.current, queueIndexRef.current, repeatModeRef.current);
        if (idx < 0) {
          wantPlayingRef.current = false;
          setIsPlaying(false);
          stopInterval();
          clearAutoPauseTimer();
          return;
        }
        advanceToRef.current(idx, karaokeMode, true);
      };

      audio.onerror = () => {
        clearStall();
        if (!isCurrent()) return;
        if (retries < 4) {
          retries += 1;
          setIsBuffering(true);
          window.setTimeout(reconnect, 800 * 2 ** (retries - 1));
        } else {
          goNext(); // unplayable after retries — keep the session moving
        }
      };

      audio.addEventListener("waiting", () => {
        if (!isCurrent()) return;
        setIsBuffering(true);
        clearStall();
        stallTimer = window.setTimeout(reconnect, 12000);
      });
      audio.addEventListener("stalled", () => {
        if (!isCurrent() || stallTimer) return;
        stallTimer = window.setTimeout(reconnect, 12000);
      });
      audio.addEventListener("playing", () => { clearStall(); retries = 0; if (isCurrent()) setIsBuffering(false); });
      audio.addEventListener("canplay", () => { if (isCurrent()) setIsBuffering(false); });

      // Start warming the next track once this one is safely buffered or nearing its end.
      const maybePrefetch = () => {
        if (prefetched || !isCurrent()) return;
        const dur = audio.duration;
        if (!dur || !isFinite(dur)) return;
        const buffered = audio.buffered.length ? audio.buffered.end(audio.buffered.length - 1) : 0;
        if (buffered >= dur - 1 || dur - audio.currentTime < 60) {
          prefetched = true;
          prefetchNext(karaokeMode);
        }
      };
      audio.addEventListener("progress", maybePrefetch);
      audio.addEventListener("timeupdate", maybePrefetch);

      audio.addEventListener("loadedmetadata", () => {
        if (!isCurrent()) return;
        setDuration(audio.duration);
        if (seekOnLoad > 0 && seekOnLoad < audio.duration) audio.currentTime = seekOnLoad;
      });
      // Preloaded element may already have metadata.
      if (audio.readyState >= 1) {
        setDuration(audio.duration);
        if (startAt > 0 && startAt < audio.duration) audio.currentTime = startAt;
      }
      if (autoplay) {
        if (audio.readyState < 3) setIsBuffering(true);
        audio.play().then(() => { if (isCurrent()) { setIsPlaying(true); startInterval(); resetAutoPauseTimer(); } }).catch(() => {});
      } else {
        setIsPlaying(false);
      }
    } else {
      // Nothing playable for this track — skip ahead instead of stalling the queue.
      setDuration(song.durationSeconds || 0);
      setIsPlaying(false);
      const idx = findNextIndex(queueRef.current, queueIndexRef.current, repeatModeRef.current);
      if (autoplay && idx >= 0 && idx !== queueIndexRef.current) {
        window.setTimeout(() => advanceToRef.current(idx, karaokeMode, true), 0);
      }
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
        wantPlayingRef.current = true;
        audioRef.current?.play();
        setIsPlaying(true);
        startInterval();
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        wantPlayingRef.current = false;
        audioRef.current?.pause();
        setIsPlaying(false);
        stopInterval();
      });
      navigator.mediaSession.setActionHandler("previoustrack", () => skipPrevRef.current());
      navigator.mediaSession.setActionHandler("nexttrack", () => skipNextRef.current());
    }
  }, [startInterval, stopInterval, resetAutoPauseTimer, clearAutoPauseTimer, discardPreload, prefetchNext]);

  internalPlayRef.current = internalPlay;

  // Move to a queue position, using the cached language-resolved song when prefetched.
  advanceToRef.current = (idx: number, karaoke: boolean, autoplay = true) => {
    const base = queueRef.current[idx];
    if (!base) return;
    queueIndexRef.current = idx;
    setQueueIndex(idx);
    const cached = resolvedCacheRef.current.get(base.id);
    internalPlayRef.current(cached || base, karaoke, 0, autoplay);
    recordPlayFn(base.id);
  };

  // Resume immediately when the connection comes back.
  useEffect(() => {
    const onOnline = () => {
      const a = audioRef.current;
      if (a && wantPlayingRef.current && a.readyState < 3) {
        const t = a.currentTime;
        try { a.load(); } catch {}
        a.addEventListener("loadedmetadata", () => { try { a.currentTime = t; } catch {} }, { once: true });
        a.play().catch(() => {});
      }
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

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

  // Plays made without a connection are queued locally and sent once back online,
  // so listening history and statistics stay complete across devices.
  const PENDING_PLAYS_KEY = "lmk-pending-plays";
  const sendPlay = useCallback(async (userId: string, songId: string, playedAt?: string) => {
    const { error } = await supabase.from("recently_played").insert({ user_id: userId, song_id: songId, ...(playedAt ? { played_at: playedAt } : {}) });
    if (error) throw error;
    await supabase.rpc("record_play", { p_song_id: songId, p_mode: "song" });
  }, []);

  const flushPendingPlays = useCallback(async () => {
    if (!navigator.onLine) return;
    let pending: { songId: string; userId: string; at: string }[] = [];
    try { pending = JSON.parse(localStorage.getItem(PENDING_PLAYS_KEY) || "[]"); } catch {}
    if (!pending.length) return;
    const left: typeof pending = [];
    for (const p of pending) {
      try { await sendPlay(p.userId, p.songId, p.at); } catch { left.push(p); }
    }
    localStorage.setItem(PENDING_PLAYS_KEY, JSON.stringify(left));
    window.dispatchEvent(new CustomEvent("recently-played-updated"));
  }, [sendPlay]);

  useEffect(() => {
    flushPendingPlays();
    window.addEventListener("online", flushPendingPlays);
    return () => window.removeEventListener("online", flushPendingPlays);
  }, [flushPendingPlays]);

  const recordPlayFn = useCallback(async (songId: string) => {
    let userId: string | undefined;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      userId = session?.user?.id;
      if (!userId) return;
      if (!navigator.onLine) throw new Error("offline");
      await sendPlay(userId, songId);
      window.dispatchEvent(new CustomEvent("recently-played-updated"));
    } catch {
      if (!userId) return;
      try {
        const pending = JSON.parse(localStorage.getItem(PENDING_PLAYS_KEY) || "[]");
        pending.push({ songId, userId, at: new Date().toISOString() });
        localStorage.setItem(PENDING_PLAYS_KEY, JSON.stringify(pending.slice(-200)));
      } catch {}
    }
  }, [sendPlay]);

  /** Phase 10: resolve the listener's preferred lyrics language before playback —
   *  swap in a ready audio version recorded in that language and its lyrics. */
  const resolvePreferred = useCallback(async (song: PlayerSong): Promise<PlayerSong> => {
    if (!featuresRef.current("translations")) return song;
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

  resolvePreferredRef.current = resolvePreferred;

  const playSong = useCallback((song: PlayerSong) => {
    resolvedCacheRef.current.clear();
    setQueue([song]);
    setQueueIndex(0);
    resolvePreferred(song).then((s) => {
      internalPlay(s, false);
      recordPlayFn(s.id);
    });
  }, [internalPlay, recordPlayFn, resolvePreferred]);

  const playVideo = useCallback((song: PlayerSong) => {
    if (!featuresRef.current("video")) return;
    playSong(song);
    setIsExpanded(true);
    setVideoModeRequest(true);
  }, [playSong]);

  const clearVideoModeRequest = useCallback(() => setVideoModeRequest(false), []);
  const requestVideoMode = useCallback(() => setVideoModeRequest(true), []);

  const singThis = useCallback((song: PlayerSong) => {
    if (!featuresRef.current("karaoke")) return;
    playSong(song);
    setIsExpanded(true);
    setKaraokeModeRequest(true);
  }, [playSong]);

  const clearKaraokeModeRequest = useCallback(() => setKaraokeModeRequest(false), []);

  const playQueue = useCallback((songs: PlayerSong[], startIndex = 0, opts?: { karaoke?: boolean }) => {
    const q = shuffleOnRef.current ? shuffleArray(songs) : songs;
    resolvedCacheRef.current.clear();
    queueRef.current = q;
    queueIndexRef.current = startIndex;
    setQueue(q);
    setQueueIndex(startIndex);
    if (q[startIndex]) {
      resolvePreferred(q[startIndex]).then((s) => {
        internalPlay(s, !!opts?.karaoke);
        recordPlayFn(s.id);
      });
    }
  }, [internalPlay, recordPlayFn, resolvePreferred]);

  const playVideoQueue = useCallback((songs: PlayerSong[], startIndex = 0) => {
    if (!featuresRef.current("video")) return;
    playQueue(songs, startIndex);
    setIsExpanded(true);
    setVideoModeRequest(true);
  }, [playQueue]);

  const skipNext = useCallback((opts?: { autoplay?: boolean } | unknown) => {
    const flag = (opts as { autoplay?: unknown } | undefined)?.autoplay;
    const autoplay = typeof flag === "boolean" ? flag : true;
    const nextIdx = findNextIndex(queueRef.current, queueIndexRef.current, repeatModeRef.current);
    if (nextIdx < 0) return;
    advanceToRef.current(nextIdx, isKaraokeRef.current, autoplay);
  }, []);

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
      if (isPlaying) { wantPlayingRef.current = false; audioRef.current.pause(); stopInterval(); clearAutoPauseTimer(); }
      else { wantPlayingRef.current = true; audioRef.current.play().catch(() => {}); startInterval(); resetAutoPauseTimer(); }
    }
    setIsPlaying((p) => !p);
  }, [isPlaying, startInterval, stopInterval, resetAutoPauseTimer, clearAutoPauseTimer]);

  const toggleKaraoke = useCallback(() => {
    const next = !isKaraokeRef.current;
    if (next && !featuresRef.current("karaoke")) return;
    isKaraokeRef.current = next;
    if (audioRef.current && currentSong) {
      // Reuse the shared playback pipeline so retries, preloading and auto-advance stay consistent.
      internalPlay(currentSong, next, audioRef.current.currentTime, isPlayingRef.current);
    } else {
      setIsKaraoke(next);
    }
  }, [currentSong, internalPlay]);

  useEffect(() => {
    if (!enabled("karaoke") && isKaraoke) toggleKaraoke();
  }, [enabled, isKaraoke, toggleKaraoke]);

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
    wantPlayingRef.current = false;
    a.pause();
    stopInterval();
    setIsPlaying(false);
    return a.currentTime;
  }, [stopInterval]);

  const resumeAt = useCallback((seconds: number) => {
    const a = audioRef.current;
    if (!a) return;
    try { a.currentTime = Math.max(0, seconds); } catch {}
    wantPlayingRef.current = true;
    a.play().then(() => { setIsPlaying(true); startInterval(); resetAutoPauseTimer(); }).catch(() => {});
  }, [startInterval, resetAutoPauseTimer]);

  return (
    <PlayerContext.Provider value={{
      currentSong, isPlaying, isKaraoke, isExpanded, progress, duration,
      currentTime, lrcLines, staticLyrics, activeLrcIndex, repeatMode, shuffleOn,
      queue, queueIndex, volume, trackEndCount, playSong, playQueue, togglePlay,
      playVideo, playVideoQueue, requestVideoMode, videoModeRequest, clearVideoModeRequest,
      singThis, karaokeModeRequest, clearKaraokeModeRequest,
      toggleKaraoke, toggleExpanded, seekTo, skipNext, skipPrev, isBuffering,
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