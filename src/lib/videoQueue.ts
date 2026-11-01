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

/**
 * The Up Next list: every upcoming queue position that can play in Video mode, in the exact
 * order Video mode will play them (the same walk nextVideoIndex uses, without a limit).
 * Shuffle is applied to the queue itself when it starts, so the queue order is the play order.
 */
export function upNextOrder(
  queue: { id: string }[],
  from: number,
  repeat: "off" | "all" | "one",
  hasVideo: (songId: string) => boolean,
): number[] {
  return upcomingIndices(queue.length, from, repeat, queue.length).filter((i) => queue[i] && hasVideo(queue[i].id));
}

/**
 * Previous button in Video mode: the closest earlier queued song that has a video, wrapping to
 * the end only with repeat-all. -1 when there is none.
 */
export function prevVideoIndex(
  queue: { id: string }[],
  from: number,
  repeat: "off" | "all" | "one",
  hasVideo: (songId: string) => boolean,
): number {
  for (let step = 1; step < queue.length; step++) {
    const raw = from - step;
    if (raw < 0 && repeat !== "all") return -1;
    const i = (raw + queue.length) % queue.length;
    if (queue[i] && hasVideo(queue[i].id)) return i;
  }
  return -1;
}
