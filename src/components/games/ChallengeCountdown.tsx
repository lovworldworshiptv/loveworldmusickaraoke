import { useEffect, useState } from "react";

export default function ChallengeCountdown({ endDate, compact = false }: { endDate: string; compact?: boolean }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = Math.max(0, new Date(endDate).getTime() - now);
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (compact) {
    return <span className="font-mono">{d}d {h}h {m}m {s}s</span>;
  }
  return (
    <div className="flex gap-2 justify-center">
      {[{ v: d, l: "Days" }, { v: h, l: "Hours" }, { v: m, l: "Min" }, { v: s, l: "Sec" }].map((b) => (
        <div key={b.l} className="bg-background/40 backdrop-blur rounded-lg px-3 py-2 text-center min-w-[58px]">
          <div className="text-xl font-bold text-amber-400 font-mono">{String(b.v).padStart(2, "0")}</div>
          <div className="text-[10px] uppercase text-muted-foreground tracking-wide">{b.l}</div>
        </div>
      ))}
    </div>
  );
}
