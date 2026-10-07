import musicAsset from "@/assets/music-quiz-card.webp.asset.json";
import articlesAsset from "@/assets/articles-game-card.webp.asset.json";
import challengeAsset from "@/assets/challenge-card.webp.asset.json";
import { hexToHsl } from "@/lib/siteSettings";

const musicPhoto = musicAsset.url;
const articlesPhoto = articlesAsset.url;
const challengePhoto = challengeAsset.url;

export type GameCardKey = "songmatch" | "articles" | "challenge";
export type GameCardPresentation = { title: string; description: string; imageUrl: string; color: string };
export const CHALLENGE_STAT_KEYS = ["prizePool", "entryFee", "players", "topPrize"] as const;
export type ChallengeStatKey = typeof CHALLENGE_STAT_KEYS[number];
export type ChallengeStatStyle = { label: string; color: string };
export type ChallengeStatsSettings = Record<ChallengeStatKey, ChallengeStatStyle> & { espColor: string };
export type GameCardSettings = Partial<Record<GameCardKey, Partial<GameCardPresentation>>> & { challengeStats?: Partial<Record<ChallengeStatKey, Partial<ChallengeStatStyle>>> & { espColor?: string } };
export const CHALLENGE_STATS_DEFAULTS: ChallengeStatsSettings = {
  prizePool: { label: "Prize Pool", color: "#ffe56b" },
  entryFee: { label: "Entry Fee", color: "#72ffb1" },
  players: { label: "Players", color: "#7ceaff" },
  topPrize: { label: "Top Prize", color: "#ffade2" },
  espColor: "#ffe56b",
};
export function resolveChallengeStats(saved?: GameCardSettings | null): ChallengeStatsSettings {
  const result = { ...CHALLENGE_STATS_DEFAULTS };
  for (const key of CHALLENGE_STAT_KEYS) {
    const value = saved?.challengeStats?.[key];
    result[key] = {
      label: value?.label?.trim().slice(0, 40) || CHALLENGE_STATS_DEFAULTS[key].label,
      color: value?.color && hexToHsl(value.color) ? value.color : CHALLENGE_STATS_DEFAULTS[key].color,
    };
  }
  const espColor = saved?.challengeStats?.espColor;
  result.espColor = espColor && hexToHsl(espColor) ? espColor : CHALLENGE_STATS_DEFAULTS.espColor;
  return result;
}
export const GAME_CARD_DEFAULTS: Record<GameCardKey, GameCardPresentation> = {
  songmatch: { title: "Music Quiz", description: "Learn and recognize Loveworld praise and worship songs through lyrics, melodies, and categories.", imageUrl: musicPhoto, color: "#0865ed" },
  articles: { title: "Articles Game", description: "Test your knowledge of Loveworld articles, authors and categories.", imageUrl: articlesPhoto, color: "#d82d57" },
  challenge: { title: "", description: "", imageUrl: challengePhoto, color: "#0865ed" },
};
export function resolveGameCard(key: GameCardKey, saved?: GameCardSettings | null): GameCardPresentation {
  const defaults = GAME_CARD_DEFAULTS[key];
  const value = saved?.[key];
  return {
    title: value?.title?.trim() || defaults.title,
    description: value?.description?.trim() || defaults.description,
    imageUrl: value?.imageUrl?.trim() || defaults.imageUrl,
    color: value?.color && hexToHsl(value.color) ? value.color : defaults.color,
  };
}