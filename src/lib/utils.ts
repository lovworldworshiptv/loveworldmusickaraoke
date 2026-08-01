import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const titleCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/** Natural (alphabetic + numeric) comparison of two song titles. */
export function compareTitles(a?: string | null, b?: string | null) {
  return titleCollator.compare(a || "", b || "");
}

/** Sorts a list of song-like objects naturally by title. */
export function sortSongsByTitle<T extends { title?: string | null }>(songs: T[]): T[] {
  return [...songs].sort((a, b) => compareTitles(a?.title, b?.title));
}
