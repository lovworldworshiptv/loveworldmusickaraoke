import { supabase } from "@/integrations/supabase/client";
import { getSetting } from "@/lib/siteSettings";
import { curatedOrder } from "@/lib/homeSections";

/** Home playlists: the admin's picks in order, else the newest homepage playlists. */
export async function loadHomePlaylists<T extends { id: string }>(settingKey: string, columns: string, limit: number): Promise<T[]> {
  const ids = await getSetting<string[]>(settingKey);
  if (ids?.length) {
    const { data } = await supabase.from("playlists").select(columns).eq("is_visible_on_homepage", true).in("id", ids);
    const picked = curatedOrder((data as unknown as T[]) || [], ids).filter((p) => ids.includes(p.id));
    if (picked.length) return picked;
  }
  const { data } = await supabase.from("playlists").select(columns).eq("is_visible_on_homepage", true)
    .order("created_at", { ascending: false }).limit(limit);
  return (data as unknown as T[]) || [];
}
