import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Search, Settings2 } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import FeaturedCarousel from "@/components/discover/FeaturedCarousel";
import CategoryTile from "@/components/discover/CategoryTile";
import GlobalSearch from "@/components/search/GlobalSearch";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useIsEditor } from "@/hooks/useIsEditor";
import type { DiscoverCategory, DiscoverFeatured } from "@/lib/discover";

const Discover = () => {
  const [searchOpen, setSearchOpen] = useState(false);
  const { isAdmin } = useIsAdmin();
  const { isEditor } = useIsEditor();

  const { data: categories = [] } = useQuery({
    queryKey: ["discover-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("discover_categories").select("*").eq("is_visible", true).order("sort_order");
      return (data || []) as DiscoverCategory[];
    },
  });
  const { data: featured = [] } = useQuery({
    queryKey: ["discover-featured"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data } = await supabase.from("discover_featured").select("*").eq("is_active", true).order("sort_order");
      return ((data || []) as DiscoverFeatured[]).filter((f) => (!f.starts_at || f.starts_at <= now) && (!f.ends_at || f.ends_at > now));
    },
  });

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 lg:pt-6 max-w-6xl mx-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-1">Discover</h1>
            <p className="text-sm text-foreground/80 mb-4">Music, karaoke, videos and more — all in one place.</p>
          </div>
          {(isAdmin || isEditor) && (
            <Link to="/admin/discover" className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-xs text-foreground hover:bg-gold/20 transition-colors">
              <Settings2 className="w-3.5 h-3.5" /> Manage
            </Link>
          )}
        </div>

        {/* Search — opens the same smart search as the top bar, with Discover results first */}
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="group relative mb-6 w-full max-w-2xl flex items-center gap-3 pl-4 pr-4 py-3.5 rounded-[14px] bg-foreground/95 text-sm text-background/60 text-left hover:scale-[1.01] focus:outline-none focus:ring-2 focus:ring-gold transition-all"
        >
          <Search className="w-5 h-5 text-background/70" />
          Search categories, playlists, songs, lyrics, articles…
        </button>
        <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />

        {featured.length > 0 && (
          <section className="mb-6">
            <h2 className="text-xl font-serif font-bold text-foreground mb-3">Featured</h2>
            <FeaturedCarousel items={featured} />
          </section>
        )}

        <section>
          <h2 className="text-xl font-serif font-bold text-foreground mb-3">Browse all</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {categories.map((c) => <CategoryTile key={c.id} c={c} />)}
          </div>
        </section>
      </div>
    </AppLayout>
  );
};

export default Discover;
