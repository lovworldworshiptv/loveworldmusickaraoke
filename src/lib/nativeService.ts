/**
 * Centralized Capacitor Native Service
 * 
 * All native platform calls are wrapped with isNativePlatform() checks.
 * Web version remains fully functional — native calls silently no-op.
 */

import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Preferences } from "@capacitor/preferences";
import { PushNotifications } from "@capacitor/push-notifications";

// ─── Platform Check ───────────────────────────────────────────────
export const isNative = () => Capacitor.isNativePlatform();

// ─── HAPTICS ──────────────────────────────────────────────────────
export const hapticPlay = async () => {
  if (!isNative()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch {}
};

export const hapticPause = async () => {
  if (!isNative()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {}
};

export const hapticDownload = async () => {
  if (!isNative()) return;
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch {}
};

export const hapticNavigation = async () => {
  if (!isNative()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {}
};

// ─── PUSH NOTIFICATIONS ──────────────────────────────────────────
export const initPushNotifications = async () => {
  if (!isNative()) return;

  try {
    const permResult = await PushNotifications.requestPermissions();
    if (permResult.receive !== "granted") {
      console.log("Push notification permission not granted");
      return;
    }

    await PushNotifications.register();

    PushNotifications.addListener("registration", (token) => {
      console.log("Push registration token:", token.value);
      // Store token for FCM use
      Preferences.set({ key: "push_token", value: token.value });
    });

    PushNotifications.addListener("registrationError", (err) => {
      console.error("Push registration error:", err.error);
    });

    PushNotifications.addListener("pushNotificationReceived", (notification) => {
      console.log("Push received:", notification);
    });

    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      console.log("Push action performed:", action);
      // Handle deep linking from notification tap
      const data = action.notification.data;
      if (data?.url) {
        window.location.href = data.url;
      }
    });
  } catch (err) {
    console.error("Push init error:", err);
  }
};

export const cleanupPushNotifications = () => {
  if (!isNative()) return;
  try {
    PushNotifications.removeAllListeners();
  } catch {}
};

// ─── OFFLINE DOWNLOADS ───────────────────────────────────────────
const DOWNLOADS_META_KEY = "offline_downloads";

interface DownloadMeta {
  songId: string;
  filePath: string;
  title: string;
  artist: string;
  coverUrl?: string;
  downloadedAt: string;
}

export const saveDownload = async (
  songId: string,
  audioUrl: string,
  meta: { title: string; artist: string; coverUrl?: string }
): Promise<boolean> => {
  if (!isNative()) return false;
  try {
    // Fetch the audio file
    const response = await fetch(audioUrl);
    const blob = await response.blob();
    const base64 = await blobToBase64(blob);

    const fileName = `song_${songId}.mp3`;

    // Write to private app data directory
    await Filesystem.writeFile({
      path: fileName,
      data: base64,
      directory: Directory.Data,
    });

    // Store metadata
    const downloads = await getDownloads();
    const newEntry: DownloadMeta = {
      songId,
      filePath: fileName,
      title: meta.title,
      artist: meta.artist,
      coverUrl: meta.coverUrl,
      downloadedAt: new Date().toISOString(),
    };

    const filtered = downloads.filter((d) => d.songId !== songId);
    filtered.push(newEntry);

    await Preferences.set({
      key: DOWNLOADS_META_KEY,
      value: JSON.stringify(filtered),
    });

    return true;
  } catch (err) {
    console.error("Download save error:", err);
    return false;
  }
};

export const getDownloads = async (): Promise<DownloadMeta[]> => {
  if (!isNative()) return [];
  try {
    const { value } = await Preferences.get({ key: DOWNLOADS_META_KEY });
    return value ? JSON.parse(value) : [];
  } catch {
    return [];
  }
};

export const removeDownload = async (songId: string): Promise<boolean> => {
  if (!isNative()) return false;
  try {
    const downloads = await getDownloads();
    const entry = downloads.find((d) => d.songId === songId);

    if (entry) {
      await Filesystem.deleteFile({
        path: entry.filePath,
        directory: Directory.Data,
      });
    }

    const filtered = downloads.filter((d) => d.songId !== songId);
    await Preferences.set({
      key: DOWNLOADS_META_KEY,
      value: JSON.stringify(filtered),
    });

    return true;
  } catch (err) {
    console.error("Download remove error:", err);
    return false;
  }
};

export const isDownloaded = async (songId: string): Promise<boolean> => {
  if (!isNative()) return false;
  const downloads = await getDownloads();
  return downloads.some((d) => d.songId === songId);
};

export const getDownloadedFileUri = async (songId: string): Promise<string | null> => {
  if (!isNative()) return null;
  try {
    const downloads = await getDownloads();
    const entry = downloads.find((d) => d.songId === songId);
    if (!entry) return null;

    const result = await Filesystem.getUri({
      path: entry.filePath,
      directory: Directory.Data,
    });
    return Capacitor.convertFileSrc(result.uri);
  } catch {
    return null;
  }
};

// ─── MEDIA SESSION (Web + Android background) ────────────────────
export const updateMediaSession = (meta: {
  title: string;
  artist: string;
  album?: string;
  coverUrl?: string;
}) => {
  if (!("mediaSession" in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: meta.title,
      artist: meta.artist,
      album: meta.album || "",
      artwork: meta.coverUrl
        ? [
            { src: meta.coverUrl, sizes: "96x96", type: "image/png" },
            { src: meta.coverUrl, sizes: "128x128", type: "image/png" },
            { src: meta.coverUrl, sizes: "192x192", type: "image/png" },
            { src: meta.coverUrl, sizes: "256x256", type: "image/png" },
            { src: meta.coverUrl, sizes: "384x384", type: "image/png" },
            { src: meta.coverUrl, sizes: "512x512", type: "image/png" },
          ]
        : [],
    });
  } catch {}
};

export const setMediaSessionHandlers = (handlers: {
  onPlay?: () => void;
  onPause?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onSeekTo?: (time: number) => void;
}) => {
  if (!("mediaSession" in navigator)) return;
  try {
    if (handlers.onPlay) navigator.mediaSession.setActionHandler("play", handlers.onPlay);
    if (handlers.onPause) navigator.mediaSession.setActionHandler("pause", handlers.onPause);
    if (handlers.onNext) navigator.mediaSession.setActionHandler("nexttrack", handlers.onNext);
    if (handlers.onPrev) navigator.mediaSession.setActionHandler("previoustrack", handlers.onPrev);
    if (handlers.onSeekTo) {
      navigator.mediaSession.setActionHandler("seekto", (details) => {
        if (details.seekTime !== undefined) handlers.onSeekTo!(details.seekTime);
      });
    }
  } catch {}
};

export const setMediaSessionPlaybackState = (state: "playing" | "paused" | "none") => {
  if (!("mediaSession" in navigator)) return;
  try {
    navigator.mediaSession.playbackState = state;
  } catch {}
};

// ─── Helpers ─────────────────────────────────────────────────────
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove the data URL prefix
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
