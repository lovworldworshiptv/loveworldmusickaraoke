import { buildShareUrl } from "@/components/share/ShareMenu";
import { tagShareUrl } from "@/lib/acquisitionAnalytics";

export type ShareCardKind = "song" | "album" | "playlist";
export type ShareCardFormat = "portrait" | "square";

export interface ShareCardItem {
  kind: ShareCardKind;
  id: string;
  title: string;
  subtitle?: string | null;
  coverUrl?: string | null;
}

export const CARD_SIZES: Record<ShareCardFormat, { w: number; h: number }> = {
  portrait: { w: 1080, h: 1350 },
  square: { w: 1080, h: 1080 },
};

export const KIND_LABELS: Record<ShareCardKind, string> = { song: "Song", album: "Album", playlist: "Playlist" };

const ALLOWED_HOSTS = new Set(["loveworldmusickaraoke.com", "www.loveworldmusickaraoke.com"]);
const ALLOWED_PATHS = new Set(["/library", "/albums", "/playlists"]);

export const slugify = (text: string) =>
  (text || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");

export const truncateTitle = (title: string, max = 80) => {
  const t = (title || "").trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  return t.slice(0, max - 1).replace(/\s+\S*$/, "").trimEnd() + "…";
};

export const cardFilename = (title: string) => `loveworld-music-${slugify(title) || "share"}.png`;

/** Untagged path each content type already shares. */
export const cardPath = (item: Pick<ShareCardItem, "kind" | "id" | "title">) => {
  const id = encodeURIComponent(item.id);
  if (item.kind === "song") return `/library?song=${id}&title=${slugify(item.title)}`;
  if (item.kind === "album") return `/albums?id=${id}`;
  return `/playlists?id=${id}`;
};

export const cardBaseUrl = (item: Pick<ShareCardItem, "kind" | "id" | "title">) => buildShareUrl(cardPath(item));
export const cardLink = (item: Pick<ShareCardItem, "kind" | "id" | "title">) => tagShareUrl(cardBaseUrl(item), "qr_card");

export const isLoveworldLink = (url: string) => {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && ALLOWED_HOSTS.has(u.hostname) && !u.port && !u.username && ALLOWED_PATHS.has(u.pathname);
  } catch {
    return false;
  }
};

/** Breaks text into at most `maxLines` lines that fit `maxWidth` (canvas measurer). */
export const wrapLines = (text: string, maxWidth: number, measure: (s: string) => number, maxLines = 2) => {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (let i = 0; i < words.length; i++) {
    const next = cur ? `${cur} ${words[i]}` : words[i];
    if (measure(next) <= maxWidth || !cur) { cur = next; continue; }
    lines.push(cur);
    cur = words[i];
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && cur) lines.push(cur);
  const used = lines.join(" ").split(" ").length;
  if (used < words.length || lines.some((l) => measure(l) > maxWidth)) {
    let last = lines[lines.length - 1];
    while (last.length > 1 && measure(last + "…") > maxWidth) last = last.slice(0, -1);
    lines[lines.length - 1] = last.trimEnd() + "…";
  }
  return lines;
};
