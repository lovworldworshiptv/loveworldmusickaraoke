import { ReactNode, useLayoutEffect, useRef, useState } from "react";
import { rememberedHeight, rememberHeight } from "@/lib/homeMemory";

/** How long a slot keeps its space for content that never arrives (e.g. a section that is now empty). */
const GIVE_UP_MS = 5000;

/**
 * Holds a home section's place at the height it had last time until its content
 * has loaded, so nothing below it jumps when it arrives.
 */
const HomeSlot = ({ id, children }: { id: string; children: ReactNode }) => {
  const inner = useRef<HTMLDivElement>(null);
  const [reserved] = useState(() => rememberedHeight(id));
  const [waiting, setWaiting] = useState(reserved > 0);

  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    const measure = () => {
      const h = el.offsetHeight;
      if (h > 0) { setWaiting(false); rememberHeight(id, h); }
    };
    measure();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    ro?.observe(el);
    const giveUp = window.setTimeout(() => {
      setWaiting(false);
      if (el.offsetHeight === 0) rememberHeight(id, 0);
    }, GIVE_UP_MS);
    return () => { ro?.disconnect(); clearTimeout(giveUp); };
  }, [id]);

  return (
    <div className="relative" data-home-slot={id} style={waiting ? { minHeight: reserved } : undefined}>
      <div ref={inner} className="flow-root">{children}</div>
      {waiting && (
        <div aria-hidden className="absolute inset-x-4 lg:inset-x-6 top-8 bottom-2 rounded-2xl bg-muted/30 animate-pulse" />
      )}
    </div>
  );
};

export default HomeSlot;
