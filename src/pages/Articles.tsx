import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Type, Video, Headphones, FileText, Music, X, ChevronRight, Minus, Plus } from "lucide-react";
import ShareInviteButton from "@/components/articles/ShareInviteButton";

import { usePlayer, type PlayerSong } from "@/contexts/PlayerContext";
import { useNavigate } from "react-router-dom";

interface Article {
  id: string;
  title: string;
  content: string;
  excerpt: string | null;
  author: string;
  category: string;
  image_url: string | null;
  video_url: string | null;
  audio_url: string | null;
  published_at: string | null;
  created_at: string;
}

type ContentMode = "text" | "video" | "audio";

const Articles = () => {
  const [searchParams] = useSearchParams();
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [fontSize, setFontSize] = useState(16);
  const [contentMode, setContentMode] = useState<ContentMode>("text");
  const [showSongSuggestion, setShowSongSuggestion] = useState(false);
  const [loading, setLoading] = useState(true);
  const { playSong } = usePlayer();
  const navigate = useNavigate();

  useEffect(() => {
    fetchArticles();
  }, []);

  // Deep link: open article by id from query param
  useEffect(() => {
    const articleId = searchParams.get("id");
    if (articleId && articles.length > 0 && !selectedArticle) {
      const found = articles.find(a => a.id === articleId);
      if (found) { setSelectedArticle(found); setContentMode("text"); }
    }
  }, [searchParams, articles]);

  // Show song suggestion popup after 10s of reading
  useEffect(() => {
    if (!selectedArticle) return;
    const timer = setTimeout(() => setShowSongSuggestion(true), 10000);
    return () => clearTimeout(timer);
  }, [selectedArticle]);

  const fetchArticles = async () => {
    const { data } = await supabase.from("articles").select("*").eq("is_published", true).order("published_at", { ascending: false });
    if (data) {
      setArticles(data);
    }
    setLoading(false);
  };

  const handleBrowseSongs = () => {
    setShowSongSuggestion(false);
    navigate("/library");
  };

  const handleRandomFeatured = async () => {
    const { data } = await supabase
      .from("songs")
      .select("*")
      .eq("is_featured", true)
      .not("audio_url", "is", null);
    if (data && data.length > 0) {
      const randomSong = data[Math.floor(Math.random() * data.length)];
      const ps: PlayerSong = {
        id: randomSong.id, title: randomSong.title, artist: randomSong.artist,
        coverUrl: randomSong.cover_url || undefined, audioUrl: randomSong.audio_url || undefined,
        durationSeconds: randomSong.duration_seconds,
      };
      playSong(ps);
    }
    setShowSongSuggestion(false);
  };

  // Article reading view
  if (selectedArticle) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto px-4 lg:px-6 pt-4 lg:pt-6">
          {/* Back button */}
          <button onClick={() => { setSelectedArticle(null); setShowSongSuggestion(false); }}
            className="text-sm text-muted-foreground hover:text-foreground mb-4 flex items-center gap-1">
            ← Back to Articles
          </button>

          {/* Content mode toggle */}
          <div className="flex items-center justify-center gap-1 mb-6">
            <button
              onClick={() => setContentMode("text")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                contentMode === "text" ? "gradient-gold text-primary-foreground" : "bg-secondary/60 text-muted-foreground"
              }`}>
              <FileText className="w-3.5 h-3.5" /> Read
            </button>
            {selectedArticle.video_url && (
              <button
                onClick={() => setContentMode("video")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                  contentMode === "video" ? "gradient-gold text-primary-foreground" : "bg-secondary/60 text-muted-foreground"
                }`}>
                <Video className="w-3.5 h-3.5" /> Watch
              </button>
            )}
            {selectedArticle.audio_url && (
              <button
                onClick={() => setContentMode("audio")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                  contentMode === "audio" ? "gradient-gold text-primary-foreground" : "bg-secondary/60 text-muted-foreground"
                }`}>
                <Headphones className="w-3.5 h-3.5" /> Listen
              </button>
            )}
          </div>

          {/* Category & Date */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gold bg-gold/10 px-2 py-0.5 rounded-full">
              {selectedArticle.category}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {selectedArticle.published_at ? new Date(selectedArticle.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
            </span>
          </div>

          {/* Hero image */}
          {selectedArticle.image_url && (
            <div className="w-full h-48 rounded-xl overflow-hidden mb-6">
              <img src={selectedArticle.image_url} alt={selectedArticle.title} className="w-full h-full object-cover" />
            </div>
          )}

          {/* Title */}
          <h1 className="text-3xl font-serif font-bold text-foreground mb-2 leading-tight">
            {selectedArticle.title}
          </h1>
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-muted-foreground">By {selectedArticle.author}</p>
            <ShareInviteButton article={selectedArticle} />
          </div>

          {/* Font Size Control */}
          <div className="flex items-center gap-3 mb-6 glass-card px-4 py-2.5 w-fit">
            <Type className="w-4 h-4 text-muted-foreground" />
            <button onClick={() => setFontSize(Math.max(12, fontSize - 2))} className="text-muted-foreground hover:text-foreground p-1">
              <Minus className="w-4 h-4" />
            </button>
            <span className="text-xs text-foreground font-medium w-8 text-center">{fontSize}</span>
            <button onClick={() => setFontSize(Math.min(28, fontSize + 2))} className="text-muted-foreground hover:text-foreground p-1">
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          {contentMode === "text" && (
            <article
              className="font-serif leading-relaxed text-foreground/90 whitespace-pre-line mb-12"
              style={{ fontSize: `${fontSize}px`, lineHeight: "1.8" }}
            >
              {selectedArticle.content}
            </article>
          )}

          {contentMode === "video" && selectedArticle.video_url && (
            <div className="aspect-video rounded-xl overflow-hidden mb-12 bg-muted">
              <iframe src={selectedArticle.video_url} className="w-full h-full" allowFullScreen />
            </div>
          )}

          {contentMode === "audio" && selectedArticle.audio_url && (
            <div className="mb-12">
              <audio src={selectedArticle.audio_url} controls className="w-full" />
              <article
                className="font-serif leading-relaxed text-foreground/90 whitespace-pre-line mt-6"
                style={{ fontSize: `${fontSize}px`, lineHeight: "1.8" }}
              >
                {selectedArticle.content}
              </article>
            </div>
          )}

          {/* Song Suggestion Popup */}
          {showSongSuggestion && (
            <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 glass-card p-4 shadow-2xl glow-gold max-w-sm w-[calc(100%-2rem)] animate-in slide-in-from-bottom-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg gradient-gold flex items-center justify-center flex-shrink-0">
                  <Music className="w-5 h-5 text-primary-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">Enhance your reading</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Play a worship song while you read?</p>
                  <div className="flex items-center gap-3 mt-2">
                    <button onClick={handleBrowseSongs}
                      className="text-xs font-semibold text-gold flex items-center gap-1 hover:underline">
                      Browse Songs <ChevronRight className="w-3 h-3" />
                    </button>
                    <button onClick={handleRandomFeatured}
                      className="text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1 hover:underline">
                      Surprise Me <Music className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <button onClick={() => setShowSongSuggestion(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="h-8" />
      </AppLayout>
    );
  }

  // Articles list view
  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 lg:pt-6 max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <BookOpen className="w-6 h-6 text-gold" />
          <h2 className="text-2xl font-serif font-bold text-foreground">Articles</h2>
        </div>

        {loading ? (
          <p className="text-muted-foreground text-sm">Loading...</p>
        ) : articles.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">No articles yet.</p>
        ) : (
          <div className="space-y-4">
            {articles.map(article => (
              <button
                key={article.id}
                onClick={() => { setSelectedArticle(article); setContentMode("text"); }}
                className="glass-card w-full text-left hover:glow-gold transition-all duration-300 group overflow-hidden"
              >
                {article.image_url && (
                  <div className="w-full h-40 overflow-hidden">
                    <img src={article.image_url} alt={article.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-gold bg-gold/10 px-2 py-0.5 rounded-full">
                      {article.category}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {article.published_at ? new Date(article.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
                    </span>
                    {article.video_url && <Video className="w-3 h-3 text-muted-foreground" />}
                    {article.audio_url && <Headphones className="w-3 h-3 text-muted-foreground" />}
                  </div>
                  <h3 className="text-base font-serif font-semibold text-foreground mb-1.5 group-hover:text-gold transition-colors line-clamp-2">
                    {article.title}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{article.excerpt || article.content.slice(0, 120)}</p>
                  <p className="text-xs text-muted-foreground">By {article.author}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="h-8" />
    </AppLayout>
  );
};

export default Articles;
