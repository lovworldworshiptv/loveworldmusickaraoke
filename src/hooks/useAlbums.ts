import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sortSongsByTitle } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";
export const useAlbums = () => useQuery({
  queryKey: ["all-albums"],
  refetchInterval: 30_000,
  queryFn: async () => {
    const albums: Tables<"albums">[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase.from("albums").select("*").order("title").order("id").range(offset, offset + 999);
      if (error) throw error;
      albums.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    return sortSongsByTitle(albums);
  },
});
