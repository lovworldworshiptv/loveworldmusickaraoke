/**
 * "Remember me" on the sign-in form.
 * - On: stay signed in on this device (default) and pre-fill the email next time.
 * - Off: the sign-in only lasts until the browser / app is closed.
 */
const PREF = "lw_remember_me";
const EMAIL = "lw_remember_email";
const ALIVE = "lw_session_alive";

const ls = () => { try { return window.localStorage; } catch { return null; } };
const ss = () => { try { return window.sessionStorage; } catch { return null; } };

export const getRememberMe = () => ls()?.getItem(PREF) !== "0";
export const getRememberedEmail = () => ls()?.getItem(EMAIL) || "";

/** Call right after a successful email/password sign-in. */
export const applyRememberMe = (remember: boolean, email: string) => {
  ls()?.setItem(PREF, remember ? "1" : "0");
  if (remember && email) ls()?.setItem(EMAIL, email.trim());
  else ls()?.removeItem(EMAIL);
  ss()?.setItem(ALIVE, "1");
};

/** Any other sign-in (KingsChat, links) counts as remembered. */
export const markRemembered = () => {
  ls()?.removeItem(PREF);
  ss()?.setItem(ALIVE, "1");
};

/**
 * True when the last sign-in asked not to be remembered and this is a fresh
 * browser/app session — the saved sign-in should be dropped. Marks the current
 * session as alive so reloads within it keep the user signed in.
 */
export const shouldForgetSession = () => {
  const forget = ls()?.getItem(PREF) === "0" && ss()?.getItem(ALIVE) !== "1";
  ss()?.setItem(ALIVE, "1");
  return forget;
};
