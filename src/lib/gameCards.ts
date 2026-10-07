import musicPhoto from "@/assets/music-quiz-card.jpg";
import articlesPhoto from "@/assets/articles-game-card.jpg";
import challengePhoto from "@/assets/challenge-card.jpg";
import { hexToHsl } from "@/lib/siteSettings";

export type GameCardKey = "songmatch" | "articles" | "challenge";
export type GameCardPresentation = { title: string; description: string; imageUrl: string; color: string };
export type GameCardSettings = Partial<Record<GameCardKey, Partial<GameCardPresentation>>>;
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