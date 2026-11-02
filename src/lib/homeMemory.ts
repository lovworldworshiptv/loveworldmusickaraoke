import { useCallback, useState } from "react";

/**
 * Home page memory: keeps each section's last loaded content (for this visit)
 * and its last drawn height (across visits), so sections never pop in, collapse
 * or push the page around while someone is scrolling.
 */

const content = new Map<string, unknown>();

type Update<T> = T | ((prev: T) => T);

/** Like useState, but the value survives leaving and coming back to the home page. */
export function useHomeState<T>(key: string, initial: T) {
  const read = () => (content.has(key) ? (content.get(key) as T) : initial);
  const [state, setState] = useState<{ key: string; value: T }>(() => ({ key, value: read() }));
  const value = state.key === key ? state.value : read();
  const set = useCallback((next: Update<T>) => {
    setState((prev) => {
      const base = prev.key === key ? prev.value : (content.has(key) ? (content.get(key) as T) : initial);
      const v = typeof next === "function" ? (next as (p: T) => T)(base) : next;
      content.set(key, v);
      return { key, value: v };
    });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return [value, set] as const;
}

const HEIGHTS_KEY = "lw_home_heights_v1";
let heights: Record<string, number> | null = null;

function loadHeights(): Record<string, number> {
  if (heights) return heights;
  try { heights = JSON.parse(localStorage.getItem(HEIGHTS_KEY) || "{}") || {}; } catch { heights = {}; }
  return heights!;
}

/** Phones, tablets and desktops lay sections out differently, so heights are kept per screen width. */
export function heightKey(id: string, width: number) {
  return `${id}@${Math.round(width / 80)}`;
}

export function rememberedHeight(id: string, width = typeof window === "undefined" ? 0 : window.innerWidth): number {
  return loadHeights()[heightKey(id, width)] || 0;
}

export function rememberHeight(id: string, height: number, width = typeof window === "undefined" ? 0 : window.innerWidth) {
  const all = loadHeights();
  const k = heightKey(id, width);
  const h = Math.max(0, Math.round(height));
  if (all[k] === h) return;
  all[k] = h;
  try { localStorage.setItem(HEIGHTS_KEY, JSON.stringify(all)); } catch { /* storage full or blocked */ }
}

/** Test helper. */
export function resetHomeMemory() {
  content.clear();
  heights = null;
}
