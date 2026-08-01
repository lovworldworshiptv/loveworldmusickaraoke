import { highlightParts } from "@/lib/fuzzySearch";

interface HighlightProps {
  text: string | null | undefined;
  query: string;
  className?: string;
}

/** Renders text with fuzzy-matched terms visually marked. */
const Highlight = ({ text, query, className }: HighlightProps) => {
  const parts = highlightParts(text || "", query);
  return (
    <span className={className}>
      {parts.map((p, i) =>
        p.match ? (
          <mark key={i} className="bg-primary/25 text-foreground rounded-[3px] px-0.5 font-semibold">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </span>
  );
};

export default Highlight;
