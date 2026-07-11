import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Music, Crown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useIsPremium } from "@/hooks/useIsPremium";
import premiumBannerBg from "@/assets/premium-banner-bg.jpg";

interface PremiumAd {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  image_url: string | null;
  cta_text: string | null;
  link_url: string | null;
}

const SecondaryBanner = () => {
  const [ad, setAd] = useState<PremiumAd | null>(null);
  const { isPremium, isTrial } = useIsPremium();
  const navigate = useNavigate();

  useEffect(() => {
    supabase
      .from("premium_ads")
      .select("*")
      .eq("is_active", true)
      .eq("placement", "secondary_banner")
      .order("sort_order")
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) setAd(data[0] as PremiumAd);
      });
  }, []);

  // Hide only for full premium users (show for free and trial)
  if (isPremium && !isTrial) return null;

  const title = ad?.title || "Upgrade to Karaoke+";
  const subtitle = ad?.subtitle || "Unlimited songs, karaoke mode, games & offline downloads.";
  const ctaText = ad?.cta_text || "Get Premium";
  const linkUrl = ad?.link_url;

  const handleClick = () => {
    if (linkUrl) {
      if (linkUrl.startsWith("http")) window.open(linkUrl, "_blank");
      else navigate(linkUrl);
    } else {
      navigate("/subscription");
    }
  };

  return (
    <section className="px-4 lg:px-6 mt-8 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
      <div
        className="relative w-full h-40 md:h-48 rounded-2xl overflow-hidden group cursor-pointer border border-gold/20 shadow-[0_0_24px_hsl(43_70%_53%/0.12)] hover:shadow-[0_0_32px_hsl(43_70%_53%/0.22)] transition-all duration-300"
        onClick={handleClick}
      >
        {(() => {
          const bgSrc = ad?.image_url || premiumBannerBg;
          return (
            <>
              <img
                src={bgSrc}
                alt={title}
                loading="lazy"
                width={1536}
                height={512}
                className="absolute inset-0 w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = premiumBannerBg;
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/70 to-background/20" />
              <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
            </>
          );
        })()}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="flex items-center justify-center w-5 h-5 rounded-full bg-gold/20">
                <Crown className="w-3 h-3 text-gold" />
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">Premium</p>
            </div>
            <h3 className="text-lg md:text-xl font-serif font-bold text-foreground mb-1">
              {title}
            </h3>
            <p className="text-xs text-muted-foreground mb-3 max-w-xs md:max-w-sm">
              {subtitle}
            </p>
            <span className="gradient-gold text-primary-foreground px-5 py-2.5 rounded-full text-xs font-semibold hover:opacity-90 transition-all duration-300 hover:shadow-[0_0_24px_hsl(43_70%_53%/0.4)] inline-block active:scale-95 touch-target">
              {ctaText}
            </span>
          </div>
          <div className="hidden md:flex items-center justify-center w-20 h-20 rounded-full bg-gold/15 border border-gold/30 group-hover:scale-110 transition-transform duration-500 shadow-[0_0_20px_hsl(43_70%_53%/0.15)]">
            <Music className="w-10 h-10 text-gold" />
          </div>
        </div>
      </div>
    </section>
  );
};

export default SecondaryBanner;
