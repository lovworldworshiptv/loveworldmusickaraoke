import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import divinityStageVideo from "@/assets/divinity-stage-ocean-mountains.mp4.asset.json";

/** Admin-managed settings stored in app_settings (key → jsonb). */
export const SETTING_KEYS = {
  theme: "theme_colors",
  homeLayout: "home_layout",
  curatedVideos: "curated_video_songs",
  curatedKaraoke: "curated_karaoke_songs",
  stageMode: "stage_mode_presentation",
  globalCardColor: "global_playlist_card_color",
  dailyDiscoverConfig: "daily_discover_config",
  dailyDiscoverSongs: "daily_discover_songs",
  communityColors: "community_background_colors",
  gameCards: "game_hub_cards",
} as const;

export type ThemeColors = { gold?: string; background?: string; accent?: string; foreground?: string; dailyDiscover?: string };
export type HomeSectionSetting = { id: string; visible: boolean };
export type StageModePresentation = {
  backgroundColor: string;
  mediaType: "none" | "image" | "video";
  mediaUrl: string;
};

export type StageBackgroundChoice = StageModePresentation & {
  id: string;
  name: string;
};

export type StageModeSetting = StageModePresentation & {
  songOverrides?: Record<string, StageModePresentation>;
  backgroundLibrary?: StageBackgroundChoice[];
};

export const DEFAULT_STAGE_MODE: StageModeSetting = {
  backgroundColor: "#000000",
  mediaType: "none",
  mediaUrl: "",
};

const MANAGED_STAGE_MEDIA = new Map([[divinityStageVideo.url, divinityStageVideo.url]]);

export function resolveStageMediaUrl(url: string) {
  return MANAGED_STAGE_MEDIA.get(url) || url;
}

export const HOME_SECTIONS: { id: string; label: string }[] = [
  { id: "moods", label: "Mood Capsules" },
  { id: "hero", label: "Hero Banner" },
  { id: "quick_picks", label: "Quick Picks" },
  { id: "recommendations", label: "Recommended Playlists" },
  { id: "albums", label: "Top Albums" },
  { id: "stories", label: "Karaoke Stories" },
  { id: "daily_discover", label: "Daily Discover" },
  { id: "featured", label: "Featured Songs" },
  { id: "videos", label: "Music Videos For You" },
  { id: "secondary_banner", label: "Secondary Banner" },
  { id: "karaoke", label: "Soundtrack For Your Day" },
  { id: "categories", label: "Categories" },
  { id: "global_playlists", label: "Global Playlists" },
  { id: "recent", label: "Recently Played" },
  { id: "articles", label: "Articles" },
];

const cache = new Map<string, unknown>();

export async function getSetting<T>(key: string): Promise<T | null> {
  if (cache.has(key)) return cache.get(key) as T;
  const { data } = await supabase.from("app_settings").select("value").eq("key", key).maybeSingle();
  const v = (data?.value ?? null) as T | null;
  cache.set(key, v);
  return v;
}

export async function saveSetting(key: string, value: unknown) {
  cache.set(key, value);
  return supabase.from("app_settings").upsert({ key, value: value as any, updated_at: new Date().toISOString() });
}

export function useSetting<T>(key: string) {
  const [value, setValue] = useState<T | null | undefined>(cache.has(key) ? (cache.get(key) as T) : undefined);
  useEffect(() => { getSetting<T>(key).then(setValue); }, [key]);
  return value;
}

/** Merge saved order with known sections so new sections still appear. */
export function resolveHomeLayout(saved: HomeSectionSetting[] | null | undefined): HomeSectionSetting[] {
  const list = (saved || []).filter((s) => HOME_SECTIONS.some((h) => h.id === s.id));
  for (const h of HOME_SECTIONS) if (!list.some((s) => s.id === h.id)) list.push({ id: h.id, visible: true });
  return list;
}

export function hexToHsl(hex: string): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** Applies admin theme colours to the CSS design tokens. */
export function applyTheme(t: ThemeColors | null | undefined) {
  if (!t) return;
  const root = document.documentElement.style;
  const set = (vars: string[], hex?: string) => {
    const hsl = hex && hexToHsl(hex);
    if (hsl) vars.forEach((v) => root.setProperty(v, hsl));
  };
  set(["--gold", "--primary", "--ring", "--sidebar-primary"], t.gold);
  set(["--background"], t.background);
  set(["--daily-discover"], t.dailyDiscover);
  set(["--accent"], t.accent);
  set(["--foreground", "--card-foreground", "--popover-foreground"], t.foreground);
}

/** Gradient for a card from an admin-chosen hex colour. */
export function cardGradient(hex: string, angle = 135) {
  const hsl = hexToHsl(hex);
  if (!hsl) return undefined;
  const [h, s] = hsl.split(" ");
  return `linear-gradient(${angle}deg, hsl(${h} ${s} 9%) 0%, hsl(${h} ${s} 20%) 55%, hsl(${h} ${s} 34%) 100%)`;
}

export function pageGradient(hex: string) {
  const hsl = hexToHsl(hex);
  if (!hsl) return undefined;
  const [h, s] = hsl.split(" ");
  return `linear-gradient(180deg, hsl(${h} ${s} 34%) 0%, hsl(${h} ${s} 20%) 45%, hsl(${h} ${s} 9%) 75%, hsl(var(--background)) 100%)`;
}

export const DEFAULT_GLOBAL_CARD = "#e42e0a";
/** Bright blue default for Global Playlists cards without their own override. */
export const GLOBAL_PLAYLISTS_CARD = "#0a6cff";

/** Admin-chosen default card colour for playlists without their own override. */
export function useGlobalCardColor() {
  const v = useSetting<string>(SETTING_KEYS.globalCardColor);
  return (typeof v === "string" && hexToHsl(v)) ? v : DEFAULT_GLOBAL_CARD;
}

/** Admin-editable Daily Discover card + collection page. */
export type DailyDiscoverConfig = { title?: string; subtitle?: string; cardColor?: string; coverUrl?: string };
export const DEFAULT_DAILY_DISCOVER_COLOR = "#39ff14";
