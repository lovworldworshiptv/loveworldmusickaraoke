import { useSyncExternalStore } from "react";

/**
 * Shared "mini player hidden" state.
 *
 * Lives outside React so the player bar and the page layout can agree on it,
 * and persists in localStorage so the choice survives navigation and reloads.
 */
const STORAGE_KEY = "lmk-player-hidden";

const listeners = new Set<(hidden: boolean) => void>();

function readStored(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

let hidden = readStored();

export function getPlayerHidden(): boolean {
  return hidden;
}

export function setPlayerHidden(next: boolean): void {
  if (hidden === next) return;
  hidden = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  } catch {
    /* storage unavailable — keep in-memory state */
  }
  listeners.forEach((listener) => listener(hidden));
}

function subscribe(listener: (hidden: boolean) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePlayerHidden(): [boolean, (hidden: boolean) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => hidden,
    () => false,
  );
  return [value, setPlayerHidden];
}
