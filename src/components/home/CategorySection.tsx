import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface Category {
  id: string;
  name: string;
  image_url: string | null;
}

const CategorySection = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    supabase
      .from("categories")
      .select("id, name, image_url")
      .eq("is_visible", true)
      .order("sort_order")
      .then(({ data }) => {
        if (data && data.length > 0) setCategories(data);
      });
  }, []);

  if (categories.length === 0) return null;

  return (
    <section className="px-4 lg:px-6 mt-8 animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-serif font-bold text-foreground">Categories</h3>
        <button onClick={() => navigate("/library")} className="text-xs text-gold hover:text-gold-light font-medium transition-colors duration-200">See All</button>
      </div>
      <div className="flex gap-5 overflow-x-auto scrollbar-hide pb-2">
        {categories.map((cat, i) => (
          <button
            key={cat.id}
            onClick={() => navigate(`/category/${cat.id}`)}
            className="flex-shrink-0 flex flex-col items-center gap-2 w-20 group cursor-pointer animate-fade-in-up"
            style={{ animationDelay: `${i * 0.08}s` }}
          >
            <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-border group-hover:border-gold transition-all duration-300 group-hover:shadow-[0_0_20px_hsl(43_70%_53%/0.2)] group-hover:scale-105">
              {cat.image_url ? (
                <img
                  src={cat.image_url}
                  alt={cat.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full gradient-purple flex items-center justify-center">
                  <span className="text-lg font-serif text-gold">{cat.name[0]}</span>
                </div>
              )}
            </div>
            <span className="text-xs text-muted-foreground text-center leading-tight group-hover:text-foreground transition-colors duration-200">{cat.name}</span>
          </button>
        ))}
      </div>
    </section>
  );
};

export default CategorySection;
