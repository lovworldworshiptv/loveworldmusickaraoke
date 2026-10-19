import { getSnapshot } from "./engine";

type Prompt = () => Promise<boolean>;
let prompt: Prompt | null = null;

/** Registered by SecureDownloadsBoot, which renders the confirmation dialog. */
export function registerSignOutPrompt(p: Prompt | null) { prompt = p; }

/**
 * Ask before signing out when this device holds offline songs (they are removed on sign-out).
 * Resolves true straight away when there is nothing saved here.
 */
export function confirmSignOut(): Promise<boolean> {
  if (!getSnapshot().items.length || !prompt) return Promise.resolve(true);
  return prompt();
}
