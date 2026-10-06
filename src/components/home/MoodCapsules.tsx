import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export interface Mood { id: string | null; name: string }

interface Props { value: string | null; onChange: (mood: Mood) => void }

/** Sticky mood filter pills driven by visible categories. */
const MoodCapsules = ({ value, onChange }: Props) => {
  const [moods, setMoods] = useState<Mood[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateFades = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    supabase.from("categories").select("id,name").eq("is_visible", true).order("sort_order")
      .then(({ data }) => setMoods((data || []).map((c) => ({ id: c.id, name: c.name }))));
  }, []);

  useEffect(() => {
    updateFades();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateFades, { passive: true });
    const ro = new ResizeObserver(updateFades);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", updateFades); ro.disconnect(); };
  }, [moods, updateFades]);

  if (!moods.length) return null;
  const all: Mood[] = [{ id: null, name: "For You" }, ...moods];

  return (
    <div className="sticky top-0 z-20 -mb-2 bg-background/80 backdrop-blur-md px-4 lg:px-6 py-3">
      <div className="relative">
        <div ref={scrollRef} role="tablist" aria-label="Filter by mood" className="flex gap-2 overflow-x-auto scrollbar-hide touch-pan-x overscroll-x-contain snap-x snap-mandatory [webkit-overflow-scrolling:touch]">
        {all.map((m) => {
          const active = value === m.id;
          return (
            <button
              key={m.id ?? "all"}
              role="tab"
              aria-selected={active}
              onClick={() => onChange(m)}
              className={cn(
                "flex-shrink-0 snap-start rounded-full px-4 py-2 text-xs font-semibold border transition-all duration-300 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
                active
                  ? "gradient-gold text-primary-foreground border-transparent shadow-[0_0_18px_hsl(43_70%_53%/0.35)] hover:shadow-[0_0_26px_hsl(43_70%_53%/0.5)] hover:-translate-y-px"
                  : "glass border-border text-white hover:border-gold/60 hover:bg-gold/10 hover:-translate-y-px hover:shadow-[0_4px_16px_hsl(43_70%_53%/0.2)]"
              )}
            >
              {m.name}
            </button>
          );
        })}
        </div>
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 w-8 rounded-l-full transition-opacity duration-300",
            canLeft ? "opacity-100" : "opacity-0"
          )}
          style={{ background: "linear-gradient(to right, hsl(var(--background) / 0.95) 20%, hsl(var(--background) / 0) 100%)" }}
        />
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 w-8 rounded-r-full transition-opacity duration-300",
            canRight ? "opacity-100" : "opacity-0"
          )}
          style={{ background: "linear-gradient(to left, hsl(var(--background) / 0.95) 20%, hsl(var(--background) / 0) 100%)" }}
        />
      </div>
    </div>
  );
};

export default MoodCapsules;
