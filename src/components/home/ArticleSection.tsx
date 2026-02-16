import { articles } from "@/data/mockData";
import { BookOpen } from "lucide-react";

const ArticleSection = () => {
  return (
    <section className="px-4 lg:px-6 mt-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-serif font-bold text-foreground">Featured Articles</h3>
        <button className="text-xs text-gold hover:underline font-medium">See All</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {articles.map((article) => (
          <article
            key={article.id}
            className="glass-card p-5 hover:glow-gold transition-all duration-300 cursor-pointer group"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gold bg-gold/10 px-2 py-0.5 rounded-full">
                {article.category}
              </span>
              <span className="text-[10px] text-muted-foreground">{article.date}</span>
            </div>
            <h4 className="text-base font-serif font-semibold text-foreground mb-2 group-hover:text-gold transition-colors line-clamp-2">
              {article.title}
            </h4>
            <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{article.excerpt}</p>
            <div className="flex items-center gap-2">
              <BookOpen className="w-3.5 h-3.5 text-gold" />
              <span className="text-xs text-muted-foreground">By {article.author}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default ArticleSection;
