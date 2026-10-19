import { Link } from "react-router-dom";
import { Disc3 } from "lucide-react";
import { useAlbums } from "@/hooks/useAlbums";
import { PRAISE_NIGHT_TITLE, praiseNightAlbums } from "@/lib/praiseNight";

const PraiseNightCard = () => {
  const { data = [] } = useAlbums();
  const albums = praiseNightAlbums(data);
  const latest = albums[0];
  return (
    <Link
      to="/albums?collection=praise-night"
      className="group block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
    >
      <div
        className="relative h-28 md:h-32 overflow-hidden rounded-2xl p-4 text-foreground transition-transform duration-300 hover:-translate-y-0.5 active:scale-[0.97] motion-reduce:transition-none"
        style={{ background: "var(--praise-night-background)" }}
      >
        <div className="relative z-10 max-w-[62%]">
          <h3 className="font-serif text-sm md:text-base font-bold leading-tight">{PRAISE_NIGHT_TITLE}</h3>
          {albums.length > 0 && <p className="mt-1 text-[11px] opacity-90">{albums.length} albums</p>}
        </div>
        {latest?.cover_url ? (
          <img
            key={latest.cover_url}
            src={latest.cover_url}
            alt={latest.title}
            loading="eager"
            width={96}
            height={96}
            className="absolute -bottom-3 -right-4 h-20 w-20 md:h-24 md:w-24 rotate-[25deg] rounded-xl object-cover shadow-2xl transition-transform duration-300 group-hover:rotate-[30deg] group-hover:scale-105 motion-reduce:transition-none"
          />
        ) : (
          <Disc3 aria-hidden="true" className="absolute bottom-3 right-3 h-16 w-16 opacity-40" />
        )}
      </div>
    </Link>
  );
};

export default PraiseNightCard;
