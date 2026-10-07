import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { type DiscoverCategory, categoryGradient, fallbackImage } from "@/lib/discover";

const CategoryTile = ({ c, preview = false }: { c: DiscoverCategory; preview?: boolean }) => {
  const img = c.image_url || fallbackImage(c.route + " " + c.title);
  const body = (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl p-4 transition-transform duration-300 active:scale-[0.97] hover:-translate-y-0.5",
        c.is_hero ? "h-36 md:h-44" : "h-28 md:h-32",
      )}
      style={{ background: categoryGradient(c), color: c.text_color }}
    >
      <div className="relative z-10 max-w-[62%]">
        {c.is_hero && (
          <span className="inline-block mb-1.5 px-2 py-0.5 rounded-full bg-background/30 backdrop-blur text-[10px] font-bold tracking-widest uppercase">
            Karaoke
          </span>
        )}
        <h3 className={cn("font-serif font-bold leading-tight", c.is_hero ? "text-2xl" : "text-lg")}>{c.title}</h3>
        {c.subtitle && <p className="text-xs mt-1 opacity-90 line-clamp-2">{c.subtitle}</p>}
      </div>
      <img
        src={img}
        alt={c.image_alt || c.title}
        loading="lazy"
        width={816}
        height={816}
        className={cn(
          "absolute -bottom-3 -right-4 rounded-xl object-cover shadow-2xl rotate-[25deg] transition-transform duration-300 group-hover:rotate-[30deg] group-hover:scale-105",
          c.is_hero ? "w-32 h-32 md:w-40 md:h-40" : "w-20 h-20 md:w-24 md:h-24",
        )}
      />
    </div>
  );
  if (preview) return body;
  return (
    <Link to={c.route} className={cn("block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-gold", c.is_hero && "col-span-2 md:col-span-3 lg:col-span-4")}>
      {body}
    </Link>
  );
};

export default CategoryTile;
