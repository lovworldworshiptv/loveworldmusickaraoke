import { useState, useRef, useEffect } from "react";
import { BookOpen, Search, X, Sparkles, Copy, Check, ChevronDown } from "lucide-react";

const VERSIONS = [
  { id: "kjv", label: "KJV", full: "King James Version" },
  { id: "web", label: "WEB", full: "World English Bible" },
  { id: "bbe", label: "BBE", full: "Bible in Basic English" },
  { id: "oeb-us", label: "OEB", full: "Open English Bible" },
  { id: "clementine", label: "Latin", full: "Clementine (Latin)" },
  { id: "almeida", label: "PT", full: "Almeida (Portuguese)" },
];

const BibleWidget = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [version, setVersion] = useState("kjv");
  const [passage, setPassage] = useState<{ reference: string; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  const searchPassage = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    setPassage(null);
    try {
      const res = await fetch(`https://bible-api.com/${encodeURIComponent(query.trim())}?translation=${version}`);
      if (!res.ok) throw new Error("Passage not found");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPassage({ reference: data.reference, text: data.text });
    } catch (err: any) {
      setError(err.message || "Could not find that passage. Try e.g. 'John 3:16' or 'Psalm 23'");
    } finally {
      setLoading(false);
    }
  };

  const copyPassage = () => {
    if (!passage) return;
    const text = `${passage.reference} (${VERSIONS.find(v => v.id === version)?.label})\n\n${passage.text}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
    <div
      ref={containerRef}
      className="relative rounded-2xl mb-6 overflow-hidden
        bg-gradient-to-br from-card/95 via-card/90 to-card/80
        border border-border/50 backdrop-blur-xl
        shadow-[0_8px_32px_rgba(0,0,0,0.12)]
        animate-in slide-in-from-top-3 fade-in duration-500"
    >
      {/* Decorative gradient orb */}
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
              <h4 className="text-sm font-bold text-foreground tracking-wide">Bible Passage</h4>
              <p className="text-[10px] text-muted-foreground mt-0.5">Search any verse or chapter</p>
            </div>
          </div>
          <button
            onClick={() => { setOpen(false); setPassage(null); setError(""); setQuery(""); }}
            className="flex items-center justify-center w-8 h-8 rounded-xl
              bg-muted/50 hover:bg-destructive/10 hover:text-destructive
              text-muted-foreground transition-all duration-300 active:scale-90"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Version selector */}
        <div className="mb-3">
          <button
            onClick={() => setShowVersions(!showVersions)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl
              bg-muted/40 hover:bg-muted/60 border border-border/30
              text-xs font-medium text-foreground transition-all duration-300"
          >
            <span className="text-primary font-bold">{selectedVersion?.label}</span>
            <span className="text-muted-foreground hidden sm:inline">— {selectedVersion?.full}</span>
            <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform duration-300 ${showVersions ? 'rotate-180' : ''}`} />
          </button>
          
          {showVersions && (
            <div className="mt-2 flex flex-wrap gap-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
              {VERSIONS.map(v => (
                <button
                  key={v.id}
                  onClick={() => { setVersion(v.id); setShowVersions(false); }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-300 active:scale-95
                    ${v.id === version
                      ? 'bg-primary/20 text-primary border border-primary/30 shadow-sm'
                      : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 border border-transparent hover:border-border/30'
                    }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Search input */}
        <div className="relative mb-4">
          <div className="relative flex items-center">
            <Search className="absolute left-3.5 w-4 h-4 text-muted-foreground/60 pointer-events-none z-10" />
            <input
              ref={inputRef}
              type="text"
              placeholder="e.g. John 3:16, Psalm 23, Romans 8:28"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && searchPassage()}
              className="w-full pl-10 pr-24 py-3 rounded-xl
                bg-muted/30 border border-border/30
                text-sm text-foreground placeholder:text-muted-foreground/50
                focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40
                focus:bg-muted/40 transition-all duration-300"
            />
            <button
              onClick={searchPassage}
              disabled={loading || !query.trim()}
              className="absolute right-1.5 px-4 py-2 rounded-lg
                bg-gradient-to-r from-primary to-primary/80
                text-primary-foreground text-xs font-bold
                disabled:opacity-40 disabled:cursor-not-allowed
                hover:shadow-[0_2px_12px_rgba(var(--primary-rgb,200,170,50),0.3)]
                active:scale-95 transition-all duration-300"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                "Search"
              )}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 mb-4 animate-in fade-in duration-300">
            <p className="text-xs text-destructive leading-relaxed">{error}</p>
          </div>
        )}

        {/* Loading shimmer */}
        {loading && (
          <div className="space-y-2 mb-4 animate-in fade-in duration-300">
            <div className="h-4 w-1/3 rounded-lg bg-muted/50 animate-pulse" />
            <div className="h-3 w-full rounded-lg bg-muted/30 animate-pulse" />
            <div className="h-3 w-5/6 rounded-lg bg-muted/30 animate-pulse" />
            <div className="h-3 w-4/6 rounded-lg bg-muted/30 animate-pulse" />
          </div>
        )}

        {/* Passage result */}
        {passage && (
          <div className="relative rounded-xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Top accent bar */}
            <div className="h-0.5 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
            
            <div className="p-4 bg-gradient-to-br from-muted/30 via-muted/20 to-transparent border border-border/20 rounded-b-xl">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-primary uppercase tracking-widest">
                  {passage.reference}
                  <span className="ml-2 text-muted-foreground font-medium normal-case tracking-normal">
                    ({selectedVersion?.label})
                  </span>
                </p>
                <button
                  onClick={copyPassage}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg
                    bg-muted/40 hover:bg-primary/10 
                    text-muted-foreground hover:text-primary
                    text-[10px] font-medium transition-all duration-300 active:scale-95"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className="text-sm text-foreground/85 leading-[1.8] font-serif whitespace-pre-line">
                {passage.text}
              </p>
            </div>
          </div>
        )}

        {/* Quick suggestions when empty */}
        {!passage && !loading && !error && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {["John 3:16", "Psalm 23", "Romans 8:28", "Philippians 4:13"].map(ref => (
              <button
                key={ref}
                onClick={() => { setQuery(ref); }}
                className="px-2.5 py-1 rounded-lg bg-muted/20 hover:bg-muted/40
                  text-[10px] text-muted-foreground hover:text-foreground
                  border border-border/20 hover:border-border/40
                  transition-all duration-300 active:scale-95"
              >
                {ref}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BibleWidget;
