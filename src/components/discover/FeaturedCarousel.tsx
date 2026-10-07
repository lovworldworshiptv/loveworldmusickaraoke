import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { type DiscoverFeatured, fallbackImage } from "@/lib/discover";

const FeaturedCard = ({ f }: { f: DiscoverFeatured }) => {
  const vid = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = vid.current;
    if (!v) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      ([e]) => (e.intersectionRatio >= 0.6 ? v.play().catch(() => {}) : v.pause()),
      { threshold: [0, 0.6, 1] },
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);
  const poster = f.poster_url || f.image_url || fallbackImage(f.label);
  const tag = f.label.replace(/^#/, "");
  return (
    <Link
      to={f.song_ids?.length ? `/discover/featured/${f.id}` : f.href || `/discover/tag/${encodeURIComponent(tag)}`}
      className="relative flex-shrink-0 w-36 md:w-44 aspect-[2/3] rounded-2xl overflow-hidden snap-start group focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
    >
      {f.media_type === "video" && f.video_url ? (
        <video ref={vid} src={f.video_url} poster={poster} muted loop playsInline preload="metadata" className="w-full h-full object-cover" />
      ) : (
        <img src={poster} alt={f.label} loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
      <span className="absolute bottom-3 left-3 px-2.5 py-1 rounded-full bg-background/50 backdrop-blur text-xs font-semibold text-foreground">
        {f.label}
      </span>
    </Link>
  );
};

const FeaturedCarousel = ({ items }: { items: DiscoverFeatured[] }) => {
  if (!items.length) return null;
  return (
    <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4 scrollbar-hide">
      {items.map((f) => <FeaturedCard key={f.id} f={f} />)}
    </div>
  );
};

export default FeaturedCarousel;
