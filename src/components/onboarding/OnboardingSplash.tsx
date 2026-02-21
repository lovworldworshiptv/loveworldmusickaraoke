import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronRight, Music2 } from "lucide-react";
import fallback1 from "@/assets/onboarding-1.jpg";
import fallback2 from "@/assets/onboarding-2.jpg";
import fallback3 from "@/assets/onboarding-3.jpg";

const fallbackImages = [fallback1, fallback2, fallback3];

interface Screen {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  image_url: string | null;
  sort_order: number;
}

interface OnboardingSplashProps {
  onComplete: () => void;
}

const OnboardingSplash = ({ onComplete }: OnboardingSplashProps) => {
  const [screens, setScreens] = useState<Screen[]>([]);
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    supabase
      .from("onboarding_screens")
      .select("*")
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => {
        if (data && data.length > 0) setScreens(data);
      });
  }, []);

  const goTo = useCallback(
    (index: number) => {
      if (animating || index === current) return;
      setDirection(index > current ? "next" : "prev");
      setAnimating(true);
      setTimeout(() => {
        setCurrent(index);
        setAnimating(false);
      }, 400);
    },
    [current, animating]
  );

  const handleNext = () => {
    if (current < screens.length - 1) {
      goTo(current + 1);
    } else {
      onComplete();
    }
  };

  const handleSkip = () => onComplete();

  if (screens.length === 0) return null;

  const screen = screens[current];
  const imageUrl = screen.image_url || fallbackImages[current % fallbackImages.length];
  const isLast = current === screens.length - 1;

  return (
    <div className="fixed inset-0 z-[100] bg-background overflow-hidden">
      {/* Background image with parallax */}
      <div
        className={`absolute inset-0 transition-all duration-700 ease-out ${
          animating
            ? direction === "next"
              ? "scale-110 opacity-0"
              : "scale-90 opacity-0"
            : "scale-100 opacity-100"
        }`}
      >
        <img
          src={imageUrl}
          alt=""
          className="w-full h-full object-cover"
        />
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 to-transparent h-32" />
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-gold/40 animate-pulse"
            style={{
              left: `${10 + Math.random() * 80}%`,
              top: `${10 + Math.random() * 50}%`,
              animationDelay: `${i * 0.3}s`,
              animationDuration: `${2 + Math.random() * 3}s`,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative h-full flex flex-col justify-end pb-12 px-6">
        {/* Skip button */}
        <button
          onClick={handleSkip}
          className="absolute top-12 right-6 text-sm text-muted-foreground hover:text-foreground transition-colors z-10 px-3 py-1.5 rounded-full bg-background/30 backdrop-blur-sm"
        >
          Skip
        </button>

        {/* Logo */}
        <div className="absolute top-12 left-6 flex items-center gap-2 z-10">
          <div className="w-8 h-8 rounded-lg gradient-gold flex items-center justify-center">
            <Music2 className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="text-sm font-serif font-bold text-foreground/80">Loveworld Music Karaoke+</span>
        </div>

        {/* Text content */}
        <div
          className={`transition-all duration-500 ease-out ${
            animating
              ? direction === "next"
                ? "translate-x-12 opacity-0"
                : "-translate-x-12 opacity-0"
              : "translate-x-0 opacity-100"
          }`}
        >
          {screen.subtitle && (
            <p className="text-gold font-medium text-sm mb-2 tracking-wider uppercase">
              {screen.subtitle}
            </p>
          )}
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground leading-tight mb-3">
            {screen.title}
          </h1>
          {screen.description && (
            <p className="text-muted-foreground text-base leading-relaxed max-w-sm">
              {screen.description}
            </p>
          )}
        </div>

        {/* Dots & Action */}
        <div className="flex items-center justify-between mt-10">
          {/* Dot indicators */}
          <div className="flex gap-2">
            {screens.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === current
                    ? "w-8 bg-gold"
                    : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                }`}
              />
            ))}
          </div>

          {/* Next / Get Started button */}
          <button
            onClick={handleNext}
            className={`flex items-center gap-2 px-6 py-3 rounded-full font-medium text-sm transition-all duration-300 active:scale-95 ${
              isLast
                ? "gradient-gold text-primary-foreground shadow-[0_0_30px_hsl(43_70%_53%/0.3)]"
                : "bg-foreground/10 backdrop-blur-sm text-foreground hover:bg-foreground/20"
            }`}
          >
            {isLast ? "Get Started" : "Next"}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingSplash;
