import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Search, BookOpen, Music2, Gamepad2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

const tabs = [
  { id: "articles", label: "Articles", icon: BookOpen, path: "/articles" },
  { id: "music", label: "Music", icon: Music2, path: "/" },
  { id: "games", label: "Games", icon: Gamepad2, path: "/games" },
];

const Discover = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 lg:pt-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-serif font-bold text-foreground mb-4">Discover</h1>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search songs, articles, games..."
            className="w-full pl-11 pr-4 py-3 rounded-xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
          />
        </div>

        {/* Category Cards */}
        <div className="grid gap-4">
          {tabs.map((tab, i) => (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              className="glass-card p-5 flex items-center gap-4 hover:glow-gold transition-all duration-300 group text-left"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="w-12 h-12 rounded-xl gradient-gold flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                <tab.icon className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">{tab.label}</h3>
                <p className="text-xs text-muted-foreground">
                  {tab.id === "articles" && "Read inspiring articles and devotionals"}
                  {tab.id === "music" && "Browse and play songs, karaoke, and more"}
                  {tab.id === "games" && "Test your knowledge with trivia games"}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
      <div className="h-8" />
    </AppLayout>
  );
};

export default Discover;
