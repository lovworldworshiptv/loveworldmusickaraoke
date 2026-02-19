/**
 * Median (GoNative) JS Bridge Utility
 *
 * Provides typed helpers that call native APIs when the app
 * runs inside a Median wrapper, and no-op gracefully in a browser.
 *
 * Docs: https://median.co/docs/javascript-bridge
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const median = (window as any).median;

/** True when running inside a Median native wrapper */
export const isMedianApp = (): boolean => {
  return typeof median !== "undefined" && !!median;
};

/** Set the native status-bar style */
export const setStatusBarStyle = (style: "light" | "dark" | "default") => {
  if (!isMedianApp()) return;
  try {
    median.statusbar.set({ style });
  } catch {
    // bridge not available
  }
};

/** Show / hide the native loading spinner */
export const showNativeLoading = (show: boolean) => {
  if (!isMedianApp()) return;
  try {
    if (show) median.spinner.start();
    else median.spinner.stop();
  } catch {
    // bridge not available
  }
};

/** Trigger native share dialog */
export const nativeShare = (url: string, text?: string) => {
  if (!isMedianApp()) return false;
  try {
    median.share.sharePage({ url, text });
    return true;
  } catch {
    return false;
  }
};

/** Open a URL in the device's external browser instead of in-app */
export const openExternal = (url: string) => {
  if (!isMedianApp()) {
    window.open(url, "_blank", "noopener");
    return;
  }
  try {
    median.open.external(url);
  } catch {
    window.open(url, "_blank", "noopener");
  }
};

/** Control the visibility of the native tab bar (if configured in Median) */
export const setTabBarVisibility = (visible: boolean) => {
  if (!isMedianApp()) return;
  try {
    median.tabNavigation.setVisibility({ visible });
  } catch {
    // bridge not available
  }
};

/** Keep the screen awake (useful during playback) */
export const keepScreenOn = (on: boolean) => {
  if (!isMedianApp()) return;
  try {
    median.screen.keepScreenOn({ enabled: on });
  } catch {
    // bridge not available
  }
};

/** Run a callback once the Median bridge is ready */
export const onMedianReady = (cb: () => void) => {
  if (typeof median !== "undefined") {
    cb();
  } else {
    document.addEventListener("median_ready", cb, { once: true });
  }
};
