import oceanMotion from "@/assets/stage/stage-ocean-sunset-motion.mp4.asset.json";
import oceanStill from "@/assets/stage/stage-ocean-sunset-still.jpg.asset.json";
import mountainMotion from "@/assets/stage/stage-mountain-clouds-motion.mp4.asset.json";
import mountainStill from "@/assets/stage/stage-mountain-clouds-still.jpg.asset.json";
import dunesMotion from "@/assets/stage/stage-sand-dunes-motion.mp4.asset.json";
import dunesStill from "@/assets/stage/stage-sand-dunes-still.jpg.asset.json";
import type { StageBackgroundChoice, StageModeSetting } from "@/lib/siteSettings";

/** Starter Stage Mode backgrounds; admins can add, rename, reorder or remove them in the CMS. */
export const BUILT_IN_STAGE_BACKGROUNDS: StageBackgroundChoice[] = [
  { id: "builtin-ocean-motion", name: "Ocean sunset", backgroundColor: "#1a0f0a", mediaType: "video", mediaUrl: oceanMotion.url, posterUrl: oceanStill.url },
  { id: "builtin-mountain-motion", name: "Mountain clouds (drone)", backgroundColor: "#0b1420", mediaType: "video", mediaUrl: mountainMotion.url, posterUrl: mountainStill.url },
  { id: "builtin-dunes-motion", name: "Sand dunes", backgroundColor: "#1f1408", mediaType: "video", mediaUrl: dunesMotion.url, posterUrl: dunesStill.url },
  { id: "builtin-ocean-still", name: "Ocean sunset", backgroundColor: "#1a0f0a", mediaType: "image", mediaUrl: oceanStill.url },
  { id: "builtin-mountain-still", name: "Mountain clouds (drone)", backgroundColor: "#0b1420", mediaType: "image", mediaUrl: mountainStill.url },
  { id: "builtin-dunes-still", name: "Sand dunes", backgroundColor: "#1f1408", mediaType: "image", mediaUrl: dunesStill.url },
];

/** The shared background library every song can use. Unset → starter set; an admin-emptied list stays empty. */
export function stageLibrary(setting: Pick<StageModeSetting, "backgroundLibrary"> | null | undefined): StageBackgroundChoice[] {
  const list = setting?.backgroundLibrary;
  return Array.isArray(list) ? list.filter((c) => c && c.id && (c.mediaType === "none" || c.mediaUrl)) : BUILT_IN_STAGE_BACKGROUNDS;
}

export type StageBackgroundTab = "all" | "motion" | "still" | "song";

export const SONG_CHOICE_IDS = ["song", "artwork"];

/** Filters background choices for the Stage Mode tabs. */
export function filterStageChoices<T extends { id: string; mediaType: string }>(choices: T[], tab: StageBackgroundTab): T[] {
  if (tab === "motion") return choices.filter((c) => !SONG_CHOICE_IDS.includes(c.id) && c.mediaType === "video");
  if (tab === "still") return choices.filter((c) => !SONG_CHOICE_IDS.includes(c.id) && c.mediaType === "image");
  if (tab === "song") return choices.filter((c) => SONG_CHOICE_IDS.includes(c.id));
  return choices;
}

/** Moves one library item to another's position. */
export function moveStageChoice(list: StageBackgroundChoice[], fromId: string, toId: string): StageBackgroundChoice[] {
  const from = list.findIndex((c) => c.id === fromId);
  const to = list.findIndex((c) => c.id === toId);
  if (from < 0 || to < 0 || from === to) return list;
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export type StageFont = { id: string; name: string; note: string; family: string; google?: string };

/** Lyric typefaces listeners can pick in Stage Mode. */
export const STAGE_FONTS: StageFont[] = [
  { id: "playfair", name: "Playfair Display", note: "Classic serif", family: "'Playfair Display', Georgia, serif" },
  { id: "cinzel", name: "Cinzel", note: "Majestic capitals", family: "'Cinzel', Georgia, serif", google: "Cinzel:wght@600;700" },
  { id: "jakarta", name: "Plus Jakarta Sans", note: "Clean modern", family: "'Plus Jakarta Sans', system-ui, sans-serif", google: "Plus+Jakarta+Sans:wght@600;700;800" },
  { id: "outfit", name: "Outfit", note: "Bold & wide", family: "'Outfit', system-ui, sans-serif", google: "Outfit:wght@600;700" },
  { id: "lora", name: "Lora", note: "Warm hymnal", family: "'Lora', Georgia, serif", google: "Lora:wght@600;700" },
  { id: "barlow", name: "Barlow Semi Condensed", note: "Tall, fits long lines", family: "'Barlow Semi Condensed', system-ui, sans-serif", google: "Barlow+Semi+Condensed:wght@600;700" },
];

export const DEFAULT_STAGE_FONT = STAGE_FONTS[0];
export const STAGE_FONT_STORAGE_KEY = "lw_stage_font_family";
export const STAGE_BACKGROUND_STORAGE_KEY = "lw_stage_background";

export function resolveStageFont(id: string | null | undefined): StageFont {
  return STAGE_FONTS.find((f) => f.id === id) || DEFAULT_STAGE_FONT;
}

/** Loads the Stage Mode typefaces once, only when Stage Mode is opened. */
export function loadStageFonts() {
  if (typeof document === "undefined" || document.getElementById("stage-fonts")) return;
  const families = STAGE_FONTS.filter((f) => f.google).map((f) => `family=${f.google}`).join("&");
  const link = document.createElement("link");
  link.id = "stage-fonts";
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
  document.head.appendChild(link);
}
