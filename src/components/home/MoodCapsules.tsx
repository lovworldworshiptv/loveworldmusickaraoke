import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export interface Mood { id: string | null; name: string }

interface Props { value: string | null; onChange: (mood: Mood) => void }

/** Sticky mood filter pills driven by visible categories. */
const MoodCapsules = ({ value, onChange }: Props) => {
  const [moods, setMoods] = useState<Mood[]>([]);

  useEffect(() => {
    supabase.from("categories").select("id,name").eq("is_visible", true).order("sort_order")
      .then(({ data }) => setMoods((data || []).map((c) => ({ id: c.id, name: c.name }))));
  }, []);

  if (!moods.length) return null;
  const all: Mood[] = [{ id: null, name: "For You" }, ...moods];

  return (
    <div className="sticky top-0 z-20 -mb-2 bg-background/80 backdrop-blur-md px-4 lg:px-6 py-3">
      <div role="tablist" aria-label="Filter by mood" className="flex gap-2 overflow-x-auto scrollbar-hide">
        {all.map((m) => {
          const active = value === m.id;
          return (
            <button
              key={m.id ?? "all"}
              role="tab"
              aria-selected={active}
              onClick={() => onChange(m)}
              className={cn(
                "flex-shrink-0 rounded-full px-4 py-2 text-xs font-semibold border transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
                active
                  ? "gradient-gold text-primary-foreground border-transparent shadow-[0_0_18px_hsl(43_70%_53%/0.35)]"
                  : "glass border-border text-muted-foreground hover:text-foreground hover:border-gold/50"
              )}
            >
              {m.name}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MoodCapsules;
