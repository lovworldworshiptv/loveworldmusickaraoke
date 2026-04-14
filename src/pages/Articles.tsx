import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Type, Video, Headphones, FileText, Music, X, ChevronRight, Minus, Plus, Search, Play } from "lucide-react";
import ShareInviteButton from "@/components/articles/ShareInviteButton";
import BibleWidget from "@/components/articles/BibleWidget";

import { usePlayer, type PlayerSong } from "@/contexts/PlayerContext";

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
  const { user } = useAuth();
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [fontSize, setFontSize] = useState(16);
  const [contentMode, setContentMode] = useState<ContentMode>("text");
  const [showSongSuggestion, setShowSongSuggestion] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSongPicker, setShowSongPicker] = useState(false);
  const [allSongs, setAllSongs] = useState<any[]>([]);
  const [songSearch, setSongSearch] = useState("");
  const { playSong } = usePlayer();
  const [bibleEnabled, setBibleEnabled] = useState(false);

  // Check admin toggle for bible widget
  useEffect(() => {
    supabase.from("app_settings").select("value").eq("key", "bible_widget_enabled").maybeSingle()
      .then(({ data }) => { if (data) setBibleEnabled((data.value as any) === true); });
  }, []);

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

  // Track article read
  useEffect(() => {
    if (!selectedArticle) return;
    supabase.from("analytics_events").insert({
      event_type: "article_read",
      user_id: user?.id || null,
      event_data: { article_id: selectedArticle.id, article_title: selectedArticle.title },
    } as any);
  }, [selectedArticle?.id]);

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

  const handleBrowseSongs = async () => {
    setShowSongSuggestion(false);
    // Fetch songs for the picker
    if (allSongs.length === 0) {
      const { data } = await supabase.from("songs").select("id, title, artist, cover_url, audio_url, duration_seconds").not("audio_url", "is", null).order("title");
      if (data) setAllSongs(data);
    }
    setShowSongPicker(true);
  };

  const handlePickSong = (song: any) => {
    const ps: PlayerSong = {
      id: song.id, title: song.title, artist: song.artist,
      coverUrl: song.cover_url || undefined, audioUrl: song.audio_url || undefined,
      durationSeconds: song.duration_seconds,
    };
    playSong(ps);
    setShowSongPicker(false);
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

          {/* Bible Widget */}
          {bibleEnabled && <BibleWidget />}

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

          {/* Song Picker Modal */}
          {showSongPicker && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowSongPicker(false)} />
              <div className="relative w-full max-w-md max-h-[70vh] glass-card rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col animate-in slide-in-from-bottom-4">
                <div className="flex items-center justify-between p-4 border-b border-border">
                  <h3 className="text-base font-serif font-bold text-foreground">Pick a Song</h3>
                  <button onClick={() => setShowSongPicker(false)} className="p-1 text-muted-foreground hover:text-foreground">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="px-4 py-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="text" placeholder="Search songs..."
                      value={songSearch} onChange={e => setSongSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
                  {allSongs
                    .filter(s => s.title.toLowerCase().includes(songSearch.toLowerCase()) || s.artist.toLowerCase().includes(songSearch.toLowerCase()))
                    .map(song => (
                      <button key={song.id} onClick={() => handlePickSong(song)}
                        className="flex items-center gap-3 w-full p-2.5 rounded-xl hover:bg-muted/60 transition-colors text-left">
                        {song.cover_url ? (
                          <img src={song.cover_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                            <Music className="w-4 h-4 text-primary" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{song.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                        </div>
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gold via-gold-light to-gold flex items-center justify-center flex-shrink-0 shadow-[0_2px_8px_hsl(43_70%_53%/0.4)]">
                          <Play className="w-3 h-3 text-white ml-0.5" fill="currentColor" />
                        </div>
                      </button>
                    ))}
                  {allSongs.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-8">No songs available</p>
                  )}
                </div>
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
