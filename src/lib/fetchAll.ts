/** The backend returns at most this many rows per request. */
export const PAGE_SIZE = 1000;

type PageResult<T> = PromiseLike<{ data: T[] | null; error: unknown }>;

/**
 * Loads every row of a list, one page at a time, so long lists (e.g. 1,000+ songs)
 * are never silently cut off. `page(from, to)` must apply `.range(from, to)` to a
 * query with a stable order (finish with `.order("id")`).
 */
export async function fetchAllRows<T>(page: (from: number, to: number) => PageResult<T>, pageSize = PAGE_SIZE): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) return rows;
  }
}

/** Every song column except the internal search index, for screens that used `select("*")`. */
export const SONG_ROW_COLUMNS =
  "id,title,artist,album,duration_seconds,cover_url,audio_url,instrumental_url,lyrics_lrc,category_id,is_featured,is_top,play_count,created_at,album_id,is_free_download,lyrics_text,original_language,dominant_color,total_sung,has_video";
