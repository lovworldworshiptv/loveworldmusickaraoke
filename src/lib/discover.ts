import music from "@/assets/discover/music.jpg";
import videos from "@/assets/discover/videos.jpg";
import karaoke from "@/assets/discover/karaoke.jpg";
import articles from "@/assets/discover/articles.jpg";
import playlists from "@/assets/discover/playlists.jpg";
import games from "@/assets/discover/games.jpg";
import community from "@/assets/discover/community.jpg";

export interface DiscoverCategory {
  id: string;
  title: string;
  subtitle: string | null;
  route: string;
  gradient_from: string;
  gradient_via: string | null;
  gradient_to: string;
  text_color: string;
  image_url: string | null;
  image_alt: string | null;
  is_hero: boolean;
  is_visible: boolean;
  sort_order: number;
}

export interface DiscoverFeatured {
  id: string;
  label: string;
  media_type: "image" | "video";
  image_url: string | null;
  video_url: string | null;
  poster_url: string | null;
  href: string | null;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  sort_order: number;
}

const FALLBACKS: [string, string][] = [
  ["karaoke", karaoke], ["video", videos], ["playlist", playlists], ["article", articles],
  ["game", games], ["community", community], ["healing", articles], ["worship", videos],
];

/** Built-in artwork used when the admin hasn't uploaded an image. */
export const fallbackImage = (key: string) => {
  const k = key.toLowerCase();
  return FALLBACKS.find(([m]) => k.includes(m))?.[1] ?? music;
};

export const categoryGradient = (c: Pick<DiscoverCategory, "gradient_from" | "gradient_via" | "gradient_to">) =>
  `linear-gradient(135deg, ${c.gradient_from}, ${c.gradient_via ? c.gradient_via + ", " : ""}${c.gradient_to})`;

const lum = (hex: string) => {
  const h = hex.replace("#", "");
  if (h.length < 6) return 0;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG contrast ratio between two hex colours. */
export const contrastRatio = (a: string, b: string) => {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};
