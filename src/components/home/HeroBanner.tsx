import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import heroBannerFallback from "@/assets/hero-banner.jpg";

interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  image_url: string | null;
  link_url: string | null;
  cta_text: string | null;
  show_cta: boolean;
}

const HeroBanner = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [current, setCurrent] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.from("hero_banners").select("*").eq("is_active", true).order("sort_order")
      .then(({ data }) => { if (data && data.length > 0) setBanners(data); });
  }, []);

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => setCurrent(c => (c + 1) % banners.length), 6000);
    return () => clearInterval(timer);
  }, [banners.length]);

  const banner = banners[current];
  const imageUrl = banner?.image_url || heroBannerFallback;

  const handleCTA = () => {
    const linkUrl = banner?.link_url;
    if (linkUrl) {
      if (linkUrl.startsWith("http")) window.open(linkUrl, "_blank");
      else navigate(linkUrl);
    } else {
      navigate("/library");
    }
  };

  return (
    <section className="relative w-full h-64 md:h-80 lg:h-96 overflow-hidden rounded-2xl mx-4 mt-4 lg:mx-6 lg:mt-6 animate-scale-fade group bg-background/95" style={{ maxWidth: 'calc(100vw - 2rem)' }}>
      <img
        src={imageUrl}
        alt={banner?.title || "Banner"}
        className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-105"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/40 to-transparent" />
      <div className="absolute bottom-4 left-4 right-4 md:bottom-6 md:left-6 md:right-6">
        {banner?.title && (
          <h2 className="text-lg sm:text-xl md:text-3xl lg:text-4xl font-serif font-bold text-foreground mb-1 md:mb-2 animate-fade-in-up" style={{ animationDelay: "0.35s" }}>
            {banner.title}
          </h2>
        )}
        {banner?.subtitle && (
          <p className="text-xs sm:text-sm md:text-base text-muted-foreground mb-1 md:mb-2 max-w-md animate-fade-in-up" style={{ animationDelay: "0.45s" }}>
            {banner.subtitle}
          </p>
        )}
        {banner?.description && (
          <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground/80 mb-2 md:mb-4 max-w-lg animate-fade-in-up line-clamp-2" style={{ animationDelay: "0.5s" }}>
            {banner.description}
          </p>
        )}
        {banner?.show_cta && banner?.cta_text && (
          <button
            onClick={handleCTA}
            className="gradient-gold text-primary-foreground px-4 py-2 md:px-6 md:py-2.5 rounded-full text-xs md:text-sm font-semibold hover:opacity-90 transition-all duration-300 hover:shadow-[0_0_24px_hsl(43_70%_53%/0.35)] animate-fade-in-up active:scale-95 touch-target"
            style={{ animationDelay: "0.55s" }}
          >
            {banner.cta_text}
          </button>
        )}
      </div>

      {banners.length > 1 && (
        <div className="absolute bottom-4 right-4 md:bottom-6 md:right-6 flex gap-1.5">
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
