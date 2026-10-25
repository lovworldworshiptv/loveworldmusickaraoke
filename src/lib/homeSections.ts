/** Admin-editable wording for home page sections (stored in app_settings). */
export type HomeSectionText = { eyebrow?: string; title?: string; cardColor?: string };
export type HomeSectionContent = Record<string, HomeSectionText>;

export const HOME_SECTION_DEFAULTS: Record<string, { eyebrow: string; title: string }> = {
  quick_picks: { eyebrow: "Start singing", title: "Quick Picks" },
  recommendations: { eyebrow: "Curated for you", title: "Recommended Playlists" },
  karaoke: { eyebrow: "Sing along", title: "Soundtrack For Your Day" },
  categories: { eyebrow: "", title: "Categories" },
  global_playlists: { eyebrow: "", title: "Global Playlists" },
};

/** Saved wording, else the built-in wording. An empty small heading hides it; an empty title keeps the default. */
export function sectionText(content: HomeSectionContent | null | undefined, id: string) {
  const def = HOME_SECTION_DEFAULTS[id] || { eyebrow: "", title: "" };
  const saved = content?.[id] || {};
  return {
    eyebrow: saved.eyebrow === undefined ? def.eyebrow : saved.eyebrow.trim(),
    title: saved.title?.trim() || def.title,
  };
}

/** Admin-picked items in the admin's order; falls back to the automatic list when nothing picked is available. */
export function curatedOrder<T extends { id: string }>(rows: T[], ids: string[] | null | undefined): T[] {
  if (!ids?.length) return rows;
  const byId = new Map(rows.map((r) => [r.id, r]));
  const picked = ids.map((id) => byId.get(id)).filter((r): r is T => !!r);
  return picked.length ? picked : rows;
}
