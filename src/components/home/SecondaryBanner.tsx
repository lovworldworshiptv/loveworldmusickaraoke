import { Music } from "lucide-react";

const SecondaryBanner = () => {
  return (
    <section className="px-4 lg:px-6 mt-8">
      <div className="relative w-full h-36 md:h-44 rounded-2xl overflow-hidden gradient-purple">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/30 to-transparent" />
        <div className="relative flex items-center h-full px-6">
          <div className="flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gold mb-1">Premium</p>
            <h3 className="text-lg md:text-xl font-serif font-bold text-foreground mb-1">
              Upgrade to Karaoke+
            </h3>
            <p className="text-xs text-muted-foreground mb-3 max-w-xs">
              Unlimited songs, karaoke mode, games & offline downloads.
            </p>
            <button className="gradient-gold text-primary-foreground px-5 py-2 rounded-full text-xs font-semibold hover:opacity-90 transition-opacity">
              Get Premium
            </button>
          </div>
          <div className="hidden md:flex items-center justify-center w-20 h-20 rounded-full bg-gold/10">
            <Music className="w-10 h-10 text-gold" />
          </div>
        </div>
      </div>
    </section>
  );
};

export default SecondaryBanner;
