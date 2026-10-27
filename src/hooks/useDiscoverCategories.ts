import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DiscoverCategory } from "@/lib/discover";

/** Visible Discover cards, shared by the Discover grid and the pages the cards open. */
export const useDiscoverCategories = () =>
  useQuery({
    queryKey: ["discover-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("discover_categories").select("*").eq("is_visible", true).order("sort_order");
      return (data || []) as DiscoverCategory[];
    },
    staleTime: 5 * 60_000,
  });
