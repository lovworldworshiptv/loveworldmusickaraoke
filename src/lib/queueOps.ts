/**
 * Pure queue edits used by the player's Up Next list. Each returns the new queue and the
 * new position of the song that is playing now, or null when nothing changes. The playing
 * song is never moved out from under the listener, so playback is never interrupted.
 */
export type QueueEdit<T> = { queue: T[]; index: number };

function reindex<T>(q: T[], current: number, order: number[]): QueueEdit<T> {
  return { queue: order.map((i) => q[i]), index: current < 0 ? current : order.indexOf(current) };
}

/** Moves the song at `from` so it ends up at position `to`. */
export function moveItem<T>(q: T[], current: number, from: number, to: number): QueueEdit<T> | null {
  if (from < 0 || from >= q.length) return null;
  const target = Math.max(0, Math.min(to, q.length - 1));
  if (target === from) return null;
  const order = q.map((_, i) => i);
  const [moved] = order.splice(from, 1);
  order.splice(target, 0, moved);
  return reindex(q, current, order);
}

/** Removes one song; the song playing now cannot be removed. */
export function removeItem<T>(q: T[], current: number, index: number): QueueEdit<T> | null {
  if (index < 0 || index >= q.length || index === current) return null;
  return reindex(q, current, q.map((_, i) => i).filter((i) => i !== index));
}

/** Moves a song so it plays straight after the one playing now. */
export function playNextItem<T>(q: T[], current: number, index: number): QueueEdit<T> | null {
  if (current < 0 || index < 0 || index >= q.length || index === current || index === current + 1) return null;
  return moveItem(q, current, index, index > current ? current + 1 : current);
}

/** Puts a song back at a position (used by Undo after a removal). */
export function insertItem<T>(q: T[], current: number, item: T, at: number): QueueEdit<T> {
  const pos = Math.max(0, Math.min(at, q.length));
  const queue = [...q.slice(0, pos), item, ...q.slice(pos)];
  return { queue, index: current >= 0 && current >= pos ? current + 1 : current };
}
