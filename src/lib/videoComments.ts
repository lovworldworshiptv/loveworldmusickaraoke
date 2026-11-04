export type CommentPart = { text: string; href?: string };

const LINK = /\bhttps?:\/\/(?:www\.)?loveworldmusickaraoke\.com(?:\/[^\s<>"']*)?/gi;

/** Splits comment text into plain parts and safe links (only the production domain is linked). */
export function linkifyComment(body: string): CommentPart[] {
  const out: CommentPart[] = [];
  let last = 0;
  for (const m of body.matchAll(LINK)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ text: body.slice(last, i) });
    out.push({ text: m[0], href: m[0] });
    last = i + m[0].length;
  }
  if (last < body.length) out.push({ text: body.slice(last) });
  return out;
}

export function relativeTime(iso: string, now = Date.now()) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24); if (d < 7) return `${d} ${d === 1 ? "day" : "days"} ago`;
  if (d < 30) return `${Math.floor(d / 7)} wk ago`;
  if (d < 365) return `${Math.floor(d / 30)} mo ago`;
  return `${Math.floor(d / 365)} yr ago`;
}
