/**
 * Lightweight fuzzy + stemming search helpers used by the Library search.
 * No dependencies — normalization, English suffix stemming, and bounded
 * Levenshtein distance for typo tolerance.
 */

/** Lowercase, strip accents and punctuation. */
export function normalize(text: string): string {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Very small Porter-like stemmer: strips common English suffixes. */
export function stem(word: string): string {
  let w = word;
  if (w.length <= 3) return w;
  if (w.endsWith("ies") && w.length > 4) return w.slice(0, -3) + "y";
  if (w.endsWith("sses")) return w.slice(0, -2);
  if (w.endsWith("es") && w.length > 4) w = w.slice(0, -2);
  else if (w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
  if (w.endsWith("ing") && w.length > 5) w = w.slice(0, -3);
  else if (w.endsWith("edly")) w = w.slice(0, -4);
  else if (w.endsWith("ed") && w.length > 4) w = w.slice(0, -2);
  if (w.endsWith("ly") && w.length > 4) w = w.slice(0, -2);
  if (w.endsWith("ness") && w.length > 5) w = w.slice(0, -4);
  if (w.endsWith("ment") && w.length > 6) w = w.slice(0, -4);
  // collapse doubled trailing consonant (runn -> run)
  if (/([bdfglmnprt])\1$/.test(w)) w = w.slice(0, -1);
  return w;
}

export function tokenize(text: string): string[] {
  const n = normalize(text);
  return n ? n.split(" ") : [];
}

/** Levenshtein distance, early-exits above `max`. */
export function levenshtein(a: string, b: string, max = 3): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** Typo tolerance allowance based on term length. */
function allowance(term: string): number {
  if (term.length <= 3) return 0;
  if (term.length <= 5) return 1;
  if (term.length <= 8) return 2;
  return 3;
}

/** Does a single query term fuzzily match anywhere in the text? */
export function termMatches(term: string, text: string): boolean {
  const nText = normalize(text);
  if (!term || !nText) return false;
  if (nText.includes(term)) return true;

  const stemmedTerm = stem(term);
  const words = nText.split(" ");
  const max = allowance(term);

  for (const w of words) {
    if (w.startsWith(term) || term.startsWith(w)) return true;
    const sw = stem(w);
    if (sw === stemmedTerm || sw.startsWith(stemmedTerm) || stemmedTerm.startsWith(sw)) return true;
    if (max > 0 && (levenshtein(term, w, max) <= max || levenshtein(stemmedTerm, sw, max) <= max)) return true;
  }
  return false;
}

/** Every query term must match at least one of the provided fields. */
export function fuzzyMatch(query: string, fields: Array<string | null | undefined>): boolean {
  const terms = tokenize(query);
  if (terms.length === 0) return true;
  const texts = fields.filter(Boolean) as string[];
  return terms.every((t) => texts.some((f) => termMatches(t, f)));
}

export type HighlightPart = { text: string; match: boolean };

/**
 * Splits `text` into parts, marking words that fuzzily match any query term.
 */
export function highlightParts(text: string, query: string): HighlightPart[] {
  const src = text || "";
  const terms = tokenize(query);
  if (!src || terms.length === 0) return [{ text: src, match: false }];

  const parts: HighlightPart[] = [];
  const re = /[\p{L}\p{N}']+/gu;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const word = m[0];
    const isMatch = terms.some((t) => termMatches(t, word));
    if (isMatch) {
      if (m.index > last) parts.push({ text: src.slice(last, m.index), match: false });
      parts.push({ text: word, match: true });
      last = m.index + word.length;
    }
  }
  if (last < src.length) parts.push({ text: src.slice(last), match: false });
  return parts.length ? parts : [{ text: src, match: false }];
}

/** Returns a short excerpt of lyrics around the first matching term. */
export function lyricsSnippet(lyrics: string | null | undefined, query: string, radius = 60): string | null {
  const terms = tokenize(query);
  if (!lyrics || terms.length === 0) return null;
  // Strip LRC timestamps
  const clean = lyrics.replace(/\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\]/g, " ").replace(/\s+/g, " ").trim();
  if (!clean) return null;

  const words = clean.split(" ");
  let hit = -1;
  for (let i = 0; i < words.length; i++) {
    if (terms.some((t) => termMatches(t, words[i]))) { hit = i; break; }
  }
  if (hit === -1) return null;

  let start = 0;
  let charCount = 0;
  for (let i = hit - 1; i >= 0; i--) {
    charCount += words[i].length + 1;
    if (charCount > radius) { start = i + 1; break; }
  }
  let end = words.length;
  charCount = 0;
  for (let i = hit + 1; i < words.length; i++) {
    charCount += words[i].length + 1;
    if (charCount > radius) { end = i; break; }
  }
  const snippet = words.slice(start, end).join(" ");
  return `${start > 0 ? "… " : ""}${snippet}${end < words.length ? " …" : ""}`;
}
