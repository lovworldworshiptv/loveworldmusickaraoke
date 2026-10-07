import { useState, type CSSProperties, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hexToHsl } from "@/lib/siteSettings";
import type { GameCardPresentation } from "@/lib/gameCards";

type Props = { presentation: GameCardPresentation; tag: string; onPlay?: () => void; children?: ReactNode; stats?: ReactNode };
export function TiltedGamePhoto({ imageUrl, title }: { imageUrl: string; title: string }) {
  const [leaning, setLeaning] = useState(false);
  return <Button variant="ghost" aria-label={`Tilt ${title} photo`} className={`game-card-photo absolute right-2 top-5 h-32 w-32 sm:h-36 sm:w-36 p-0 overflow-hidden rounded-xl ${leaning ? "is-leaning" : ""}`}
    onClick={() => setLeaning(value => !value)}>
    <img src={imageUrl} alt={`${title} artwork`} loading="lazy" width={768} height={768} className="h-full w-full object-cover" />
  </Button>;
}
export default function GameHubCard({ presentation, tag, onPlay, children, stats }: Props) {
  return (
    <article className="game-hub-card group relative overflow-hidden rounded-2xl p-6"
      style={{ "--game-card-background": hexToHsl(presentation.color) } as CSSProperties}>
      <TiltedGamePhoto imageUrl={presentation.imageUrl} title={presentation.title} />
      <div className="relative max-w-[calc(100%-100px)] min-h-[142px] pointer-events-none">
        <p className="text-xs font-semibold mb-3">{tag}</p>
        <h3 className="text-2xl font-bold leading-tight mb-3 break-words">{presentation.title}</h3>
      </div>
      <p className="relative text-sm leading-relaxed mb-4 min-h-[60px]">{presentation.description}</p>
      {stats}
      <div className="relative flex flex-wrap items-center gap-2 mt-5">
        <Button onClick={onPlay} className="game-card-play gap-2 rounded-full px-5">Play Now <ArrowRight className="w-4 h-4" /></Button>
        {children}
      </div>
    </article>
  );
}