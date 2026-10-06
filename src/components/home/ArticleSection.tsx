import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Article {
  id: string;
  title: string;
  excerpt: string | null;
  author: string;
  category: string;
  published_at: string | null;
}

const ArticleSection = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.from("articles").select("id, title, excerpt, author, category, published_at")
      .eq("is_published", true).eq("is_featured", true).order("published_at", { ascending: false }).limit(3)
      .then(({ data }) => {
        if (data && data.length > 0) setArticles(data);
      });
  }, []);

  if (articles.length === 0) return null;

  return (
    <section className="px-4 lg:px-6 mt-8 animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-serif font-bold text-foreground">Featured Articles</h3>
        <button onClick={() => navigate("/articles")} className="text-xs text-gold hover:text-gold-light font-medium transition-colors duration-200">See All</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {articles.map((article, i) => (
          <article
            key={article.id}
            onClick={() => navigate(`/articles?id=${article.id}`)}
            className="glass-card p-5 hover:glow-gold transition-all duration-300 cursor-pointer group hover:-translate-y-1 animate-fade-in-up"
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gold bg-gold/10 px-2 py-0.5 rounded-full">
                {article.category}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {article.published_at ? new Date(article.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
              </span>
            </div>
            <h4 className="text-base font-serif font-semibold text-foreground mb-2 group-hover:text-gold transition-colors duration-200 line-clamp-2">
              {article.title}
            </h4>
            <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{article.excerpt}</p>
            <div className="flex items-center gap-2">
              <BookOpen className="w-3.5 h-3.5 text-gold" />
              <span className="text-xs font-medium text-white">By {article.author}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default ArticleSection;