export const PRAISE_NIGHT_TITLE = "Praise Night With Pastor Chris";
type AlbumTitle = { title: string };
const normalize = (title: string) => title.toLowerCase().replace(/\s+/g, " ").trim();
export const isPraiseNightAlbum = (album: AlbumTitle) => normalize(album.title).includes(normalize(PRAISE_NIGHT_TITLE));
export const praiseNightEdition = (album: AlbumTitle) => {
  const match = album.title.match(/(\d+)\s*["'”’)]?\s*$/);
  return match ? Number(match[1]) : -1;
};
export const praiseNightAlbums = <T extends AlbumTitle>(albums: T[]): T[] =>
  albums.filter(isPraiseNightAlbum).sort((a, b) => praiseNightEdition(b) - praiseNightEdition(a) || a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: "base" }));
