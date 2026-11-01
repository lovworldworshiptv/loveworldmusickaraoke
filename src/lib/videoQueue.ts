/** Queue positions after `from`, in play order, wrapping only when repeat-all is on. */
export function upcomingIndices(length: number, from: number, repeat: "off" | "all" | "one", limit = 50): number[] {
  const out: number[] = [];
  for (let step = 1; step < length && out.length < limit; step++) {
    const raw = from + step;
    if (raw >= length && repeat !== "all") break;
    out.push(raw % length);
  }
  return out;
}

/**
 * Continuous Video mode: the next queued song that has a video, skipping songs without one.
 * Returns -1 when no upcoming song has a video (the player then falls back to audio).
 */
export function nextVideoIndex(
  queue: { id: string }[],
  from: number,
  repeat: "off" | "all" | "one",
  hasVideo: (songId: string) => boolean,
  limit = 50,
): number {
  for (const i of upcomingIndices(queue.length, from, repeat, limit)) {
    if (queue[i] && hasVideo(queue[i].id)) return i;
  }
  return -1;
}
