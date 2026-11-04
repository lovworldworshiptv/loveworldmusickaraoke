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
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7); if (w < 5) return `${w}w ago`;
  return new Date(iso).toLocaleDateString();
}
