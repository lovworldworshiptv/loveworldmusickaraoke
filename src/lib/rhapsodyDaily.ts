import DOMPurify from "dompurify";
import { supabase } from "@/integrations/supabase/client";

/**
 * Rhapsody Daily — today's devotional from read.rhapsodyofrealities.org.
 * The site embeds the full article as `window.dailyDevotional = {...}` in its HTML
 * and allows cross-origin reads, so the browser fetches it directly; the
 * `rhapsody-daily` function is a fallback if that ever fails.
 */
export const RHAPSODY_SOURCE_URL = "https://read.rhapsodyofrealities.org/";
const CACHE_KEY = "ror_daily_v1";
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

export interface RhapsodyDevotional {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  excerpt: string;
  openingScripture: string;
  bodyHtml: string;
  prayerLabel: string;
  prayer: string;
  furtherStudyTitle: string;
  furtherStudy: string;
  oneYearTitle: string;
  oneYear: string;
  twoYearTitle: string;
  twoYear: string;
  imageUrl: string | null;
  audioUrl: string | null;
}

/** Pull the JSON object assigned to window.dailyDevotional, matching braces outside strings. */
export function extractDevotionalJson(html: string): any | null {
  const marker = html.search(/window\.dailyDevotional\s*=\s*\{/);
  if (marker < 0) return null;
  const start = html.indexOf("{", marker);
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) {
      try { return JSON.parse(html.slice(start, i + 1)); } catch { return null; }
    }
  }
  return null;
}

/** Daily narration lives at roraudio.b-cdn.net/{year}/{month name}/{day}.mp3. */
export function rhapsodyAudioUrl(date: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || "");
  if (!m) return null;
  const month = MONTHS[Number(m[2]) - 1];
  if (!month) return null;
  return `https://roraudio.b-cdn.net/${m[1]}/${month}/${Number(m[3])}.mp3`;
}

const plain = (s: string) =>
  s.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/[^\p{L}\p{N}]+/gu, " ").trim().toLowerCase();

/** The body repeats the opening scripture as its first paragraph; drop it since it is shown separately. */
export function stripLeadingScripture(bodyHtml: string, opening: string): string {
  const first = /^\s*<p\b[^>]*>([\s\S]*?)<\/p>/i.exec(bodyHtml);
  if (!first || !opening) return bodyHtml;
  const a = plain(first[1]).slice(0, 40);
  const b = plain(opening).slice(0, 40);
  return a && a === b ? bodyHtml.slice(first[0].length) : bodyHtml;
}

/** Allow only simple formatting and links; every link opens outside the app. */
export function sanitizeDevotionalHtml(html: string): string {
  const clean = DOMPurify.sanitize(html || "", {
    ALLOWED_TAGS: ["p", "br", "strong", "b", "em", "i", "u", "a", "ul", "ol", "li", "blockquote", "h3", "h4", "span"],
    ALLOWED_ATTR: ["href"],
  });
  return clean.replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ');
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const titleCase = (s: string) => s.toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase());

export function normalizeDevotional(raw: any): RhapsodyDevotional | null {
  const a = raw?.article;
  if (!a || !str(a.title) || !str(a.content_body)) return null;
  const date = str(a.upload_date) || str(raw.date);
  const opening = str(a.opening_scripture).replace(/\s+/g, " ");
  return {
    id: str(a.id) || date,
    date,
    title: str(a.title),
    excerpt: str(a.excerpt),
    openingScripture: opening,
    bodyHtml: sanitizeDevotionalHtml(stripLeadingScripture(str(a.content_body), opening)),
    prayerLabel: titleCase(str(a.option) || "prayer"),
    prayer: str(a.confession_or_prayer),
    furtherStudyTitle: titleCase(str(a.further_study_title) || "Further Study"),
    furtherStudy: str(a.further_study),
    oneYearTitle: titleCase(str(a.one_yearbb_title) || "1-Year Bible Reading Plan"),
    oneYear: str(a.one_yearbb),
    twoYearTitle: titleCase(str(a.two_yearbb_title) || "2-Year Bible Reading Plan"),
    twoYear: str(a.two_yearbb),
    imageUrl: str(a.photo_link) || null,
    audioUrl: rhapsodyAudioUrl(date),
  };
}

/** "2026-10-25" → "Sunday, October 25, 2026" without timezone drift. */
export function formatDevotionalDate(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || "");
  if (!m) return date;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

export function readCachedDevotional(): RhapsodyDevotional | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw).data as RhapsodyDevotional) : null;
  } catch { return null; }
}

function writeCache(data: RhapsodyDevotional) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), data })); } catch { /* storage full */ }
}

async function fetchDirect(): Promise<RhapsodyDevotional | null> {
  const res = await fetch(RHAPSODY_SOURCE_URL, { cache: "no-store", signal: AbortSignal.timeout(12000) });
  if (!res.ok) return null;
  return normalizeDevotional(extractDevotionalJson(await res.text()));
}

async function fetchViaFunction(): Promise<RhapsodyDevotional | null> {
  const { data, error } = await supabase.functions.invoke("rhapsody-daily");
  if (error) return null;
  return normalizeDevotional(data);
}

/** Always fetches fresh; falls back to the backend copy, then to the last saved devotional. */
export async function fetchRhapsodyDaily(): Promise<RhapsodyDevotional | null> {
  let fresh: RhapsodyDevotional | null = null;
  try { fresh = await fetchDirect(); } catch { /* fall through */ }
  if (!fresh) { try { fresh = await fetchViaFunction(); } catch { /* fall through */ } }
  if (fresh) writeCache(fresh);
  return fresh || readCachedDevotional();
}
