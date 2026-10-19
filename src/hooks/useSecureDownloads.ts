import { useSyncExternalStore } from "react";
import { subscribe, getSnapshot } from "@/lib/secureDownloads/engine";

/** Live state of the offline download queue on this device. */
export const useSecureDownloads = () => useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
