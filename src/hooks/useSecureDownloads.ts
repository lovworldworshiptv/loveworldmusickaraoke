import { useSyncExternalStore } from "react";
import { subscribe, getSnapshot } from "@/lib/secureDownloads/engine";
import type { SecureStatus } from "@/lib/secureDownloads/types";

/** Live state of the offline download queue on this device. */
export const useSecureDownloads = () => useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

/**
 * One song's download state. Re-renders only when that song's status, active flag, whole
 * percentage or Wi-Fi wait changes — safe to use on every card in a long list.
 */
export function useSongDownload(songId: string) {
  const read = () => {
    const st = getSnapshot();
    const item = st.items.find((i) => i.songId === songId);
    const p = st.progress[songId];
    const pct = p && p.total ? Math.round((p.done / p.total) * 100) : 0;
    return `${item?.status ?? ""}|${st.activeSongId === songId ? 1 : 0}|${pct}|${st.waitingFor === "wifi" && !st.allowCellular ? 1 : 0}`;
  };
  const key = useSyncExternalStore(subscribe, read, read);
  const [status, active, pct, wifi] = key.split("|");
  return { status: (status || undefined) as SecureStatus | undefined, active: active === "1", pct: Number(pct), waitingWifi: wifi === "1" };
}
