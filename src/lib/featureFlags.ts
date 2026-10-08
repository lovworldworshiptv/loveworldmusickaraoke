export const FEATURES = [
  { id: "community", key: "community_enabled", label: "Community", group: "Experiences" },
  { id: "stage", key: "stage_mode_enabled", label: "Stage Mode", group: "Experiences" },
  { id: "translations", key: "translations_enabled", label: "Lyrics & languages", group: "Playback" },
  { id: "video", key: "video_mode_enabled", label: "Video mode & Videos", group: "Playback" },
  { id: "karaoke", key: "karaoke_mode_enabled", label: "Karaoke mode", group: "Playback" },
  { id: "motion", key: "motion_artwork_enabled", label: "Motion artwork", group: "Playback" },
  { id: "recording", key: "karaoke_record_enabled", label: "Karaoke recording", group: "Playback" },
  { id: "stories", key: "karaoke_stories_visible", label: "Karaoke Stories", group: "Experiences" },
  { id: "myKaraoke", key: "my_karaoke_visible", label: "My Karaoke", group: "Experiences" },
  { id: "moments", key: "moments_enabled", label: "Moments", group: "Experiences" },
  { id: "studio", key: "studio_enabled", label: "My Studio", group: "Experiences" },
  { id: "referrals", key: "referrals_enabled", label: "Referrals & commissions", group: "Experiences" },
  { id: "reminders", key: "reminders_enabled", label: "Prayer & study reminders", group: "Experiences" },
  { id: "games", key: "games_enabled", label: "Games & challenges", group: "Explore" },
  { id: "articles", key: "articles_enabled", label: "Articles", group: "Explore" },
  { id: "bible", key: "bible_widget_enabled", label: "Bible widget", group: "Explore" },
  { id: "playlists", key: "playlists_enabled", label: "Playlists", group: "Explore" },
  { id: "albums", key: "albums_enabled", label: "Albums", group: "Explore" },
  { id: "discover", key: "discover_enabled", label: "Discovery & mood capsules", group: "Explore" },
] as const;

export type FeatureId = typeof FEATURES[number]["id"];
export type FeatureValues = Partial<Record<FeatureId, boolean>>;
const dependencies: Partial<Record<FeatureId, FeatureId[]>> = {
  recording: ["karaoke"], stories: ["karaoke"], myKaraoke: ["karaoke"],
  moments: ["video"], bible: ["articles"],
};

export function isFeatureEnabled(values: FeatureValues, id: FeatureId): boolean {
  return values[id] !== false && (dependencies[id] || []).every((parent) => isFeatureEnabled(values, parent));
}

export function featureForPath(path: string): FeatureId | undefined {
  if (path.startsWith("/admin/")) return undefined;
  const prefix = path.split(/[/?]/)[1];
  return ({ community: "community", stage: "stage", videos: "video", moments: "moments",
    studio: "studio", reminders: "reminders", games: "games", smchallenge: "games",
    articles: "articles", playlists: "playlists", collection: "playlists", albums: "albums",
    discover: "discover", referrals: "referrals" } as Record<string, FeatureId>)[prefix];
}

export const HOME_FEATURES: Record<string, FeatureId> = {
  moods: "discover", quick_picks: "discover", daily_discover: "discover", recommendations: "playlists",
  global_playlists: "playlists", albums: "albums", stories: "stories", videos: "video",
  karaoke: "karaoke", articles: "articles",
};