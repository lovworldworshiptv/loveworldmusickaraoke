/** Fired after a listener changes their lyrics language, so the player reloads it. */
export const PREFERRED_LANGUAGE_EVENT = "lw-preferred-language-changed";

export interface PreferredLanguage {
  /** First preferred language code, or null when none is set. */
  lang: string | null;
  /** song id → ready full recording in that language. */
  audio: Map<string, string>;
}

/**
 * Picks the recording in the listener's language without any network call, so playback can
 * start inside the tap. Offline, songs keep their saved copy.
 */
export function preferredAudioFor<T extends { id: string; audioUrl?: string | null }>(
  song: T,
  pref: PreferredLanguage,
  online: boolean,
): T {
  if (!pref.lang || pref.lang === "en") return song;
  if (!online && song.audioUrl?.startsWith("blob:")) return song;
  const url = pref.audio.get(song.id);
  return url && url !== song.audioUrl ? { ...song, audioUrl: url } : song;
}
