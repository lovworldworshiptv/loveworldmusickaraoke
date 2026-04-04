import { useState, useRef, useEffect } from "react";
import { BookOpen, Search, X, Sparkles, Copy, Check, ChevronDown, Share2, Bookmark } from "lucide-react";

const VERSIONS = [
  { id: "kjv", label: "KJV", full: "King James Version" },
  { id: "web", label: "WEB", full: "World English Bible" },
  { id: "bbe", label: "BBE", full: "Bible in Basic English" },
  { id: "oeb-us", label: "OEB", full: "Open English Bible" },
  { id: "clementine", label: "Latin", full: "Clementine (Latin)" },
  { id: "almeida", label: "PT", full: "Almeida (Portuguese)" },
];

interface BibleVerse {
  book_name: string;
  chapter: number;
  verse: number;
  text: string;
}

interface BibleResult {
  reference: string;
  verses: BibleVerse[];
  text: string;
  translation_name: string;
}

const BibleWidget = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [version, setVersion] = useState("kjv");
  const [result, setResult] = useState<BibleResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [highlightedVerse, setHighlightedVerse] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  const searchPassage = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    setHighlightedVerse(null);
    try {
      const res = await fetch(`https://bible-api.com/${encodeURIComponent(query.trim())}?translation=${version}`);
      if (!res.ok) throw new Error("Passage not found");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Could not find that passage. Try e.g. 'John 3:16' or 'Psalm 23'");
    } finally {
      setLoading(false);
    }
  };

  const copyPassage = () => {
    if (!result) return;
    const selectedVersion = VERSIONS.find(v => v.id === version);
    const versesText = result.verses
      .map(v => `${v.verse} ${v.text.trim()}`)
      .join("\n");
    const text = `${result.reference} (${selectedVersion?.label || version.toUpperCase()})\n\n${versesText}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyVerse = (verse: BibleVerse) => {
    const selectedVersion = VERSIONS.find(v => v.id === version);
    const text = `${verse.text.trim()}\n— ${verse.book_name} ${verse.chapter}:${verse.verse} (${selectedVersion?.label})`;
    navigator.clipboard.writeText(text);
    setHighlightedVerse(verse.verse);
    setTimeout(() => setHighlightedVerse(null), 1500);
  };

  const selectedVersion = VERSIONS.find(v => v.id === version);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="group relative flex items-center gap-3 px-5 py-3 rounded-2xl 
          bg-gradient-to-r from-primary/10 via-primary/5 to-transparent
          border border-primary/20 hover:border-primary/40
          hover:shadow-[0_0_20px_rgba(var(--primary-rgb,200,170,50),0.15)]
          transition-all duration-500 ease-out text-sm font-medium text-foreground w-fit
          active:scale-[0.97]"
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-xl 
          bg-gradient-to-br from-primary/30 to-primary/10
          group-hover:from-primary/40 group-hover:to-primary/20
          transition-all duration-500">
          <BookOpen className="w-4 h-4 text-primary" />
        </div>
        <span className="font-semibold tracking-wide">Bible Passage</span>
        <Sparkles className="w-3.5 h-3.5 text-primary/60 group-hover:text-primary transition-colors duration-300" />
      </button>
    );
  }

  return (
    <div className="relative rounded-2xl mb-6 overflow-hidden
      bg-gradient-to-br from-card/95 via-card/90 to-card/80
      border border-border/50 backdrop-blur-xl
      shadow-[0_8px_32px_rgba(0,0,0,0.12)]
      animate-in slide-in-from-top-3 fade-in duration-500"
    >
      {/* Decorative elements */}
      <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-primary/3 blur-2xl pointer-events-none" />

      <div className="relative p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl 
              bg-gradient-to-br from-primary/25 to-primary/10 shadow-sm">
              <BookOpen className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground tracking-wide">Bible</h4>
              <p className="text-[10px] text-muted-foreground mt-0.5">Search verses, chapters & books</p>
            </div>
          </div>
          <button
            onClick={() => { setOpen(false); setResult(null); setError(""); setQuery(""); }}
            className="flex items-center justify-center w-8 h-8 rounded-xl
              bg-muted/50 hover:bg-destructive/10 hover:text-destructive
              text-muted-foreground transition-all duration-300 active:scale-90"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search bar — YouVersion style with book/version selectors */}
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => setShowVersions(!showVersions)}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl shrink-0
              bg-muted/40 hover:bg-muted/60 border border-border/30
              text-xs font-bold text-primary transition-all duration-300"
          >
            {selectedVersion?.label}
            <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform duration-300 ${showVersions ? 'rotate-180' : ''}`} />
          </button>

          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search e.g. John 3:16, Psalm 23"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && searchPassage()}
              className="w-full pl-9 pr-3 py-2.5 rounded-xl
                bg-muted/30 border border-border/30
                text-sm text-foreground placeholder:text-muted-foreground/40
                focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40
                transition-all duration-300"
            />
          </div>

          <button
            onClick={searchPassage}
            disabled={loading || !query.trim()}
            className="px-4 py-2.5 rounded-xl shrink-0
              bg-gradient-to-r from-primary to-primary/80
              text-primary-foreground text-xs font-bold
              disabled:opacity-40 disabled:cursor-not-allowed
              hover:shadow-[0_2px_12px_rgba(var(--primary-rgb,200,170,50),0.3)]
              active:scale-95 transition-all duration-300"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Version chips */}
        {showVersions && (
          <div className="flex flex-wrap gap-1.5 mb-3 animate-in fade-in slide-in-from-top-1 duration-200">
            {VERSIONS.map(v => (
              <button
                key={v.id}
                onClick={() => { setVersion(v.id); setShowVersions(false); }}
                className={`px-3 py-1.5 rounded-xl text-xs transition-all duration-300 active:scale-95
                  ${v.id === version
                    ? 'bg-primary text-primary-foreground font-bold shadow-sm'
                    : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 font-medium'
                  }`}
              >
                <span className="font-bold">{v.label}</span>
                <span className="hidden sm:inline ml-1 opacity-70 font-normal">· {v.full}</span>
              </button>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 mb-4 animate-in fade-in duration-300">
            <p className="text-xs text-destructive leading-relaxed">{error}</p>
          </div>
        )}

        {/* Loading shimmer — YouVersion style */}
        {loading && (
          <div className="py-6 space-y-4 animate-in fade-in duration-300">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex gap-3 items-start">
                <div className="w-4 h-4 rounded bg-muted/40 animate-pulse shrink-0 mt-1" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 rounded bg-muted/30 animate-pulse" style={{ width: `${85 - i * 10}%` }} />
                  <div className="h-4 rounded bg-muted/20 animate-pulse" style={{ width: `${70 - i * 8}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Scripture display — YouVersion style */}
        {result && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Reference header bar */}
            <div className="flex items-center justify-between px-1 mb-4">
              <div>
                <h3 className="text-lg font-bold text-foreground font-serif">{result.reference}</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-widest">
                  {result.translation_name || selectedVersion?.full}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={copyPassage}
                  className="flex items-center justify-center w-8 h-8 rounded-lg
                    hover:bg-muted/50 text-muted-foreground hover:text-primary
                    transition-all duration-300 active:scale-90"
                  title="Copy all"
                >
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-border/50 to-transparent mb-5" />

            {/* Verses — YouVersion reading style */}
            <div className="px-1 sm:px-4 pb-2">
              {result.verses.map((verse, idx) => (
                <span
                  key={`${verse.chapter}-${verse.verse}-${idx}`}
                  onClick={() => copyVerse(verse)}
                  className={`inline cursor-pointer transition-colors duration-300 
                    hover:bg-primary/10 rounded-sm
                    ${highlightedVerse === verse.verse ? 'bg-primary/15' : ''}`}
                >
                  <sup className="text-[10px] font-bold text-primary/70 mr-0.5 select-none align-top">
                    {verse.verse}
                  </sup>
                  <span className="text-[15px] sm:text-base text-foreground/90 leading-[2] font-serif">
                    {verse.text.replace(/\n/g, ' ').trim()}{' '}
                  </span>
                </span>
              ))}
            </div>

            {/* Tap hint */}
            <p className="text-[9px] text-muted-foreground/50 text-center mt-4 italic">
              Tap any verse to copy it
            </p>

            {/* Bottom divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-border/30 to-transparent mt-3 mb-2" />

            {/* Copyright / attribution */}
            <p className="text-[9px] text-muted-foreground/40 text-center leading-relaxed">
              {result.translation_name || selectedVersion?.full}
            </p>
          </div>
        )}

        {/* Quick suggestions when empty */}
        {!result && !loading && !error && (
          <div className="mt-2">
            <p className="text-[10px] text-muted-foreground/50 mb-2 uppercase tracking-wider font-medium">Popular</p>
            <div className="flex flex-wrap gap-1.5">
              {["John 3:16", "Psalm 23", "Romans 8:28", "Philippians 4:13", "Proverbs 3:5-6", "Isaiah 40:31"].map(ref => (
                <button
                  key={ref}
                  onClick={() => setQuery(ref)}
                  className="px-3 py-1.5 rounded-full bg-muted/20 hover:bg-primary/10
                    text-[11px] text-muted-foreground hover:text-primary font-medium
                    border border-border/15 hover:border-primary/25
                    transition-all duration-300 active:scale-95"
                >
                  {ref}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BibleWidget;
