import { Link } from "react-router-dom";
import { Disc3 } from "lucide-react";
import { useAlbums } from "@/hooks/useAlbums";
import { PRAISE_NIGHT_TITLE, praiseNightAlbums } from "@/lib/praiseNight";
const PraiseNightCard = () => {
  const { data = [] } = useAlbums();
  const albums = praiseNightAlbums(data);
  const latest = albums[0];
  return (
    <Link to="/albums?collection=praise-night" className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
      <div className="relative h-40 md:h-44 overflow-hidden rounded-2xl bg-primary text-primary-foreground p-4 transition-transform duration-300 hover:-translate-y-0.5 active:scale-[0.97] motion-reduce:transition-none">
        <div className="relative z-10 max-w-[68%]">
          <h3 className="font-serif text-lg font-bold leading-tight">{PRAISE_NIGHT_TITLE}</h3>
          {albums.length > 0 && <p className="mt-2 text-xs">{albums.length} albums</p>}
        </div>
        {latest?.cover_url ? (
          <img key={latest.cover_url} src={latest.cover_url} alt={latest.title} loading="eager" width={112} height={112}
            className="absolute -bottom-3 -right-4 h-24 w-24 md:h-28 md:w-28 rotate-[25deg] rounded-xl object-cover shadow-2xl transition-transform duration-300 group-hover:rotate-[30deg] motion-reduce:transition-none" />
        ) : <Disc3 aria-hidden="true" className="absolute bottom-3 right-3 h-16 w-16 opacity-40" />}
      </div>
    </Link>
  );
};
export default PraiseNightCard;
