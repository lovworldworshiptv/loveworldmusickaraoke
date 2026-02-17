import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import heroBannerFallback from "@/assets/hero-banner.jpg";

interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  link_url: string | null;
}

const HeroBanner = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    supabase.from("hero_banners").select("*").eq("is_active", true).order("sort_order")
      .then(({ data }) => { if (data && data.length > 0) setBanners(data); });
  }, []);

  // Auto-rotate banners
  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => setCurrent(c => (c + 1) % banners.length), 6000);
    return () => clearInterval(timer);
  }, [banners.length]);

  const banner = banners[current];
  const imageUrl = banner?.image_url || heroBannerFallback;
  const title = banner?.title || "Praise Night Live 2026";
  const subtitle = banner?.subtitle || "Experience the glory of worship with the Loveworld Singers — streaming now.";

  return (
    <section className="relative w-full h-64 md:h-80 lg:h-96 overflow-hidden rounded-2xl mx-4 mt-4 lg:mx-6 lg:mt-6 animate-scale-fade group" style={{ maxWidth: 'calc(100vw - 2rem)' }}>
      <img
        src={imageUrl}
        alt={title}
        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/40 to-transparent" />
      <div className="absolute bottom-6 left-6 right-6">
        <p className="text-xs font-medium text-gold uppercase tracking-[0.2em] mb-2 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
          Featured
        </p>
        <h2 className="text-2xl md:text-4xl font-serif font-bold text-foreground mb-2 animate-fade-in-up" style={{ animationDelay: "0.35s" }}>
          {title}
        </h2>
        <p className="text-sm text-muted-foreground mb-4 max-w-md animate-fade-in-up" style={{ animationDelay: "0.45s" }}>
          {subtitle}
        </p>
        <button className="gradient-gold text-primary-foreground px-6 py-2.5 rounded-full text-sm font-semibold hover:opacity-90 transition-all duration-300 hover:shadow-[0_0_24px_hsl(43_70%_53%/0.35)] animate-fade-in-up active:scale-95 touch-target" style={{ animationDelay: "0.55s" }}>
          Listen Now
        </button>
      </div>

      {/* Dots indicator */}
      {banners.length > 1 && (
        <div className="absolute bottom-6 right-6 flex gap-1.5">
          {banners.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)}
              className={`w-2 h-2 rounded-full transition-all ${i === current ? "bg-gold w-5" : "bg-foreground/30"}`} />
          ))}
        </div>
      )}
    </section>
  );
};

export default HeroBanner;
