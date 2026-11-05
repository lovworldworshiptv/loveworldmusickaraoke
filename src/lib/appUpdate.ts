/** Admin-managed "update your app" notice (app_settings key app_update_notice). */
export const APP_UPDATE_KEY = "app_update_notice";
export const UPDATED_STORAGE_KEY = "lw_app_updated_version";

export type AppUpdateNotice = {
  enabled?: boolean;
  /** Changes each time the admin sends a new update; users who updated to it never see it again. */
  version?: string;
  title?: string;
  message?: string;
  buttonLabel?: string;
  /** Store/download link. Empty means "reload the website to the latest version". */
  url?: string;
  /** Newest Android version code; the Android app hides the popup on this version or newer. */
  latestVersionCode?: number;
};

/** True when the notice should be shown to someone who last updated to `updatedVersion`. */
export function shouldShowUpdate(notice: AppUpdateNotice | null | undefined, updatedVersion: string | null): boolean {
  if (!notice || notice.enabled !== true) return false;
  const v = notice.version?.trim();
  if (!v) return false;
  return updatedVersion !== v;
}
