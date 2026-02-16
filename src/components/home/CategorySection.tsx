import catPraise from "@/assets/cat-praise.jpg";
import catHealing from "@/assets/cat-healing.jpg";
import catOrchestra from "@/assets/cat-orchestra.jpg";
import catChoral from "@/assets/cat-choral.jpg";
import { categories } from "@/data/mockData";

const categoryImages: Record<string, string> = {
  "Praise & Worship": catPraise,
  "Healing": catHealing,
  "Orchestra": catOrchestra,
  "Choral": catChoral,
};

const CategorySection = () => {
  return (
    <section className="px-4 lg:px-6 mt-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-serif font-bold text-foreground">Categories</h3>
        <button className="text-xs text-gold hover:underline font-medium">See All</button>
      </div>
      <div className="flex gap-5 overflow-x-auto scrollbar-hide pb-2">
        {categories.map((cat) => (
          <div key={cat.id} className="flex-shrink-0 flex flex-col items-center gap-2 w-20">
            <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-border hover:border-gold transition-colors duration-300 cursor-pointer">
              {categoryImages[cat.name] ? (
                <img
                  src={categoryImages[cat.name]}
                  alt={cat.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full gradient-purple flex items-center justify-center">
                  <span className="text-lg font-serif text-gold">{cat.name[0]}</span>
                </div>
              )}
            </div>
            <span className="text-xs text-muted-foreground text-center leading-tight">{cat.name}</span>
          </div>
        ))}
      </div>
    </section>
  );
};

export default CategorySection;
