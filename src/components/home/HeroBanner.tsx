import heroBanner from "@/assets/hero-banner.jpg";

const HeroBanner = () => {
  return (
    <section className="relative w-full h-64 md:h-80 lg:h-96 overflow-hidden rounded-2xl mx-4 mt-4 lg:mx-6 lg:mt-6 animate-scale-fade group">
      <img
        src={heroBanner}
        alt="Loveworld Music worship banner"
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
          Praise Night Live 2026
        </h2>
        <p className="text-sm text-muted-foreground mb-4 max-w-md animate-fade-in-up" style={{ animationDelay: "0.45s" }}>
          Experience the glory of worship with the Loveworld Singers — streaming now.
        </p>
        <button className="gradient-gold text-primary-foreground px-6 py-2.5 rounded-full text-sm font-semibold hover:opacity-90 transition-all duration-300 hover:shadow-[0_0_24px_hsl(43_70%_53%/0.35)] animate-fade-in-up" style={{ animationDelay: "0.55s" }}>
          Listen Now
        </button>
      </div>
    </section>
  );
};

export default HeroBanner;
