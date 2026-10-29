/** Shapes and helpers for the admin Command Centre, filled by the admin_command_centre database function. */

export type Range = "7d" | "30d" | "all";

/** Days to look back for each range; null means all time. */
export function rangeDays(range: Range): number | null {
  return range === "7d" ? 7 : range === "30d" ? 30 : null;
}

export type Part = { label: string; value: number };

export type CommandCentreStats = {
  generated_at: string;
  users: { total: number; completed_profile: number; incomplete_profile: number; new_in_range: number; new_7d: number; with_location: number; without_location: number };
  roles: { admin: number; editor: number };
  subs: {
    free: number; trial: number; premium: number;
    premium_1_month: number; premium_3_months: number; premium_6_months: number; premium_1_year: number; premium_other: number;
    expired_to_free: number; expiring_premium: number; expiring_trial: number;
  };
  plays: {
    total: number; song: number; karaoke: number; video: number; guest: number; songs_played: number;
    listeners: number; listeners_premium: number; listeners_trial: number; listeners_free: number; all_time: number;
  };
  songs: { total: number; featured: number; with_video: number; with_lyrics: number; with_karaoke_track: number; instrumentals: number; free: number };
  favorites: { total: number; in_range: number; users: number; songs: number };
  downloads: { total: number; in_range: number; removed: number; users: number; songs: number };
  recordings: { total: number; in_range: number; singers: number; live_24h: number };
  articles: { total: number; published: number; drafts: number; featured: number; reads_in_range: number };
  games: { total: number; in_range: number; players: number; by_mode: Record<string, number> };
  stems: { total: number; pending: number; processing: number; ready: number; failed: number };
  alerts: { total: number; unread: number; unread_by_type: Record<string, number> };
  issues: { artwork: number; audio: number; lyrics: number; karaoke_track: number; video: number; category: number; songs_affected: number };
  play_days: { date: string; plays: number; karaoke: number; video: number }[];
  user_days: { date: string; users: number }[];
  top_songs: { id: string; title: string; artist: string; cover_url: string | null; plays: number; listeners: number; karaoke: number; favorites: number; downloads: number; engagement: number }[];
  engaged: { user_id: string; username: string | null; avatar_url: string | null; plays: number }[];
  locations: { name: string; users: number }[];
  locations_count: number;
  create_menu: Record<string, number>;
  channels: { channel: string; shares: number; visits: number; signups: number; downloads: number }[];
  download_surfaces: { name: string; clicks: number }[];
};

/** Premium split by plan; the 3-month and "other" rows only appear when someone is on them. */
export function premiumPlanParts(subs: CommandCentreStats["subs"]): Part[] {
  const parts: Part[] = [
    { label: "1 month", value: subs.premium_1_month },
    { label: "3 months", value: subs.premium_3_months },
    { label: "6 months", value: subs.premium_6_months },
    { label: "1 year", value: subs.premium_1_year },
    { label: "Other plan", value: subs.premium_other },
  ];
  return parts.filter((p) => p.value > 0 || p.label === "1 month" || p.label === "6 months" || p.label === "1 year");
}

/** Active listeners split by their plan right now (expired plans count as free). */
export function listenerTierParts(plays: CommandCentreStats["plays"]): Part[] {
  return [
    { label: "Premium", value: plays.listeners_premium },
    { label: "Free trial", value: plays.listeners_trial },
    { label: "Free", value: plays.listeners_free },
  ];
}

export function sumParts(parts: Part[]): number {
  return parts.reduce((total, p) => total + p.value, 0);
}

const GAME_MODE_LABELS: Record<string, string> = { lyrics: "Lyrics", category: "Category", melody: "Melody", articles: "Articles" };
export const gameModeLabel = (mode: string) => GAME_MODE_LABELS[mode] ?? mode.replace(/_/g, " ");

const ALERT_LABELS: Record<string, string> = {
  stem_started: "Karaoke track started",
  stem_completed: "Karaoke track ready",
  stem_failed: "Karaoke track failed",
};
export const alertTypeLabel = (type: string) => ALERT_LABELS[type] ?? type.replace(/_/g, " ");

export const CREATE_MENU_OPTIONS = ["Playlist", "Studio Mode", "Reminders", "Stage Mode"];

export const fmt = (n: number | null | undefined) => (n ?? 0).toLocaleString("en-US");
