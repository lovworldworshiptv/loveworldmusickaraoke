import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Music, Sparkles, Crown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useIsPremium } from "@/hooks/useIsPremium";

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
        className="relative w-full h-36 md:h-44 rounded-2xl overflow-hidden group cursor-pointer"
        onClick={handleClick}
      >
        {ad?.image_url ? (
          <>
            <img src={ad.image_url} alt={title} className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-background/50 to-transparent" />
          </>
        ) : (
          <>
            <div className="absolute inset-0 gradient-purple" />
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-transparent to-primary/10" />
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-gold/5 rounded-full blur-3xl" />
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-accent/10 rounded-full blur-3xl" />
          </>
        )}
        <div className="relative flex items-center h-full px-6">
          <div className="flex-1">
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles className="w-3 h-3 text-gold" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-gold">Premium</p>
            </div>
            <h3 className="text-lg md:text-xl font-serif font-bold text-foreground mb-1">
              {title}
            </h3>
            <p className="text-xs text-muted-foreground mb-3 max-w-xs">
              {subtitle}
            </p>
            <span className="gradient-gold text-primary-foreground px-5 py-2 rounded-full text-xs font-semibold hover:opacity-90 transition-all duration-300 hover:shadow-[0_0_20px_hsl(43_70%_53%/0.3)] inline-block">
              {ctaText}
            </span>
          </div>
          <div className="hidden md:flex items-center justify-center w-20 h-20 rounded-full bg-gold/10 border border-gold/20 group-hover:scale-110 transition-transform duration-500">
            <Music className="w-10 h-10 text-gold" />
          </div>
        </div>
      </div>
    </section>
  );
};

export default SecondaryBanner;
