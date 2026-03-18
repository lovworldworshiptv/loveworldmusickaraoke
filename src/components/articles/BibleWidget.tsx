import { useState } from "react";
import { BookOpen, Search, X, ChevronLeft } from "lucide-react";

const VERSIONS = [
  { id: "kjv", label: "KJV" },
  { id: "web", label: "WEB" },
  { id: "bbe", label: "BBE" },
  { id: "oeb-us", label: "OEB" },
  { id: "clementine", label: "Clementine (Latin)" },
  { id: "almeida", label: "Almeida (Portuguese)" },
];

const BibleWidget = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [version, setVersion] = useState("kjv");
  const [passage, setPassage] = useState<{ reference: string; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 glass-card hover:glow-gold transition-all text-sm font-medium text-foreground w-fit"
      >
        <BookOpen className="w-4 h-4 text-gold" />
        Bible Passage
      </button>
    );
  }

  return (
    <div className="glass-card p-4 mb-6 animate-in slide-in-from-top-2">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-gold" />
          <h4 className="text-sm font-serif font-bold text-foreground">Bible Passage</h4>
        </div>
        <button onClick={() => { setOpen(false); setPassage(null); setError(""); setQuery(""); }} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex gap-2 mb-3">
        <select
          value={version}
          onChange={e => setVersion(e.target.value)}
          className="px-2 py-2 rounded-lg bg-muted border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {VERSIONS.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
        </select>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="e.g. John 3:16, Psalm 23"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && searchPassage()}
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <button
          onClick={searchPassage}
          disabled={loading || !query.trim()}
          className="px-4 py-2 rounded-lg gradient-gold text-primary-foreground text-sm font-semibold disabled:opacity-50"
        >
          {loading ? "..." : "Search"}
        </button>
      </div>

      {error && <p className="text-xs text-destructive mb-2">{error}</p>}

      {passage && (
        <div className="bg-muted/50 rounded-lg p-4 border border-border">
          <p className="text-xs font-semibold text-gold mb-2 uppercase tracking-wider">{passage.reference} ({VERSIONS.find(v => v.id === version)?.label || version.toUpperCase()})</p>
          <p className="text-sm text-foreground/90 leading-relaxed font-serif whitespace-pre-line">{passage.text}</p>
        </div>
      )}
    </div>
  );
};

export default BibleWidget;
