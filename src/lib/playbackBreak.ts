// Free-listener playback break: after every 2 finished non-free songs, a 10-second
// full-screen break runs before the next song. Premium, trial, editor and admin never get it.

export const BREAK_EVERY = 2;
export const BREAK_SECONDS = 10;

/** Count a finished song; returns the new count and whether a break is due now. */
export function countFinishedSong(count: number, songIsFree: boolean): { count: number; breakNow: boolean } {
  if (songIsFree) return { count, breakNow: false };
  const next = count + 1;
  if (next >= BREAK_EVERY) return { count: 0, breakNow: true };
  return { count: next, breakNow: false };
}

export function isBreakExempt(a: { isPremium: boolean; isTrial: boolean; isEditor: boolean; isAdmin: boolean }): boolean {
  return a.isPremium || a.isTrial || a.isEditor || a.isAdmin;
}

export function isVideoUrl(url: string | null | undefined): boolean {
  return !!url && /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url);
}

type Song = { id?: string; isFreeDownload?: boolean | null };
/** Resolves true to continue to the next song, false to stop playback. */
type Gate = (song: Song) => Promise<boolean>;
let gate: Gate | null = null;

export function setBreakGate(g: Gate | null) { gate = g; }
export function runBreakGate(song: Song): Promise<boolean> {
  return gate ? gate(song).catch(() => true) : Promise.resolve(true);
}
