import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import heroBannerFallback from "@/assets/hero-banner.jpg";
import { useHomeState } from "@/lib/homeMemory";
import { useRhapsodyDaily } from "@/hooks/useRhapsodyDaily";
import { formatDevotionalDate } from "@/lib/rhapsodyDaily";

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

const RATIO_KEY = "lw_hero_ratio_v1";
const FALLBACK: Banner = { id: "fallback", title: "", subtitle: null, description: null, image_url: null, link_url: null, cta_text: null, show_cta: false };

const savedRatio = () => {
  const n = Number(typeof localStorage === "undefined" ? 0 : localStorage.getItem(RATIO_KEY));
  return n > 0.5 && n < 6 ? n : 16 / 9;
};

const HeroBanner = () => {
  const [banners, setBanners] = useHomeState<Banner[] | null>("hero", null);
  // One height for every slide (the tallest picture's shape) so the page never moves when slides change.
  const [ratio, setRatio] = useState(savedRatio);
  const [current, setCurrent] = useState(0);
  const navigate = useNavigate();
  const { devotional } = useRhapsodyDaily();

  useEffect(() => {
    supabase.from("hero_banners").select("*").eq("is_active", true).order("sort_order")
      .then(({ data, error }) => { if (!error) setBanners((data as Banner[]) || []); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Today's Rhapsody of Realities leads the carousel and updates itself whenever a new day is published.
  const rhapsody: Banner | null = devotional?.imageUrl ? {
    id: `rhapsody-${devotional.id}-${devotional.date}`,
    title: devotional.title,
    subtitle: `Rhapsody Daily, ${formatDevotionalDate(devotional.date)}`,
    description: null,
    image_url: devotional.imageUrl,
    link_url: "/articles?rhapsody=today",
    cta_text: "Study Now",
    show_cta: true,
  } : null;
  const adminSlides = banners === null ? [] : banners.length ? banners : (rhapsody ? [] : [FALLBACK]);
  const slides = banners === null && !rhapsody ? [] : rhapsody ? [rhapsody, ...adminSlides] : adminSlides;
  const urls = slides.map((b) => b.image_url || heroBannerFallback);
  const urlKey = urls.join("|");

  useEffect(() => {
    if (!urls.length) return;
    let cancelled = false;
    const shapes: number[] = [];
    urls.forEach((src) => {
      const img = new Image();
      img.onload = () => {
        if (cancelled || !img.naturalWidth || !img.naturalHeight) return;
        shapes.push(img.naturalWidth / img.naturalHeight);
        const tallest = Math.min(...shapes);
        setRatio((r) => {
          // Grow to fit taller pictures as they load; shrink only once every picture is known.
          const next = shapes.length === urls.length ? tallest : Math.min(r, tallest);
          if (shapes.length === urls.length) { try { localStorage.setItem(RATIO_KEY, String(next)); } catch { /* ignore */ } }
          return next;
        });
      };
      img.src = src;
    });
    return () => { cancelled = true; };
  }, [urlKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => setCurrent(c => (c + 1) % slides.length), 6000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const index = slides.length ? current % slides.length : 0;
  const banner = slides[index];
  // The Rhapsody Daily slide keeps the same height as the other banners (e.g. the
  // Loveworld Music Challenge banner); a blurred extension of its own picture fills
  // the frame so the topic, date and scripture sit gracefully over the extension.
  const isRhapsody = !!banner?.id.startsWith("rhapsody-");
  const frameRatio = ratio;

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
    <section
      className="relative w-full overflow-hidden rounded-2xl mx-4 mt-4 lg:mx-6 lg:mt-6 bg-background group transition-[aspect-ratio] duration-700"
      style={{ maxWidth: 'calc(100vw - 2rem)', aspectRatio: String(frameRatio) }}
      aria-roledescription="carousel"
    >
      {!slides.length && <div aria-hidden className="absolute inset-0 bg-muted/30 animate-pulse" />}
      {/* Every picture is shown whole; slides cross-fade in place so nothing around them moves */}
      {slides.map((b, i) => (
        <div key={b.id} className={`absolute inset-0 transition-opacity duration-700 ${i === index ? "opacity-100" : "opacity-0"}`} aria-hidden={i !== index}>
          {/* Rhapsody Daily only: the day's picture is trimmed to its photograph and
              fills the hero frame edge to edge — no blurred extension, no empty bars */}
          <img
            src={urls[i]}
            alt={i === index ? (b.title || "Banner") : ""}
            className={`absolute inset-0 block w-full h-full ${b.id.startsWith("rhapsody-") ? "object-cover object-center" : "object-contain object-top"}`}
            loading={i === 0 ? "eager" : "lazy"}
            decoding="async"
          />
        </div>
      ))}
      {isRhapsody ? (
        // Rhapsody Daily: a soft dark scrim under the white topic/date keeps them readable
        // over the picture, which fills the hero frame with no blurred extension
        <div className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-black/85 via-black/45 to-transparent" />
      ) : (
        <>
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/40 to-transparent" />
        </>
      )}
      <div className="absolute bottom-4 left-4 right-4 md:bottom-6 md:left-6 md:right-6">
        {banner?.title && (
          <h2 className={`max-w-[18ch] sm:max-w-md md:max-w-xl text-lg sm:text-xl md:text-3xl lg:text-4xl font-serif ${isRhapsody ? "font-black" : "font-bold"} mb-1 md:mb-2 text-balance ${isRhapsody ? "text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]" : "text-foreground"}`}>
            {banner.title}
          </h2>
        )}
        {banner?.subtitle && (
          <p className={`text-xs sm:text-sm md:text-base mb-1 md:mb-2 max-w-md ${isRhapsody ? "text-white/90 drop-shadow-[0_1px_6px_rgba(0,0,0,0.8)]" : "text-muted-foreground"}`}>
            {banner.subtitle}
          </p>
        )}
        {banner?.description && (
          <p className={`text-[10px] sm:text-xs md:text-sm mb-2 md:mb-4 max-w-lg line-clamp-2 text-muted-foreground/80`}>
            {banner.description}
          </p>
        )}
        {banner?.show_cta && banner?.cta_text && (
          <button
            onClick={handleCTA}
            className="gradient-gold text-primary-foreground px-4 py-2 md:px-6 md:py-2.5 rounded-full text-xs md:text-sm font-semibold hover:opacity-90 transition-all duration-300 hover:shadow-[0_0_24px_hsl(43_70%_53%/0.35)] active:scale-95 touch-target"
          >
            {banner.cta_text}
          </button>
        )}
      </div>

      {slides.length > 1 && (
        <div className="absolute bottom-4 right-4 md:bottom-6 md:right-6 flex gap-1.5">
          {slides.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)} aria-label={`Show banner ${i + 1}`}
              className={`w-2 h-2 rounded-full transition-all ${i === index ? "bg-gold w-5" : isRhapsody ? "bg-white/60" : "bg-foreground/30"}`} />
          ))}
        </div>
      )}
    </section>
  );
};

export default HeroBanner;
