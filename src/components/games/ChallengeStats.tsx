import type { CSSProperties } from "react";
import { CHALLENGE_STAT_KEYS, type ChallengeStatKey, type ChallengeStatsSettings } from "@/lib/gameCards";
import { hexToHsl } from "@/lib/siteSettings";

export default function ChallengeStats({ settings, values, prizes }: {
  settings: ChallengeStatsSettings;
  values: Record<ChallengeStatKey, string | number>;
  prizes: Record<string, number>;
}) {
  return <>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
      {CHALLENGE_STAT_KEYS.map(key => <div key={key} className="challenge-stat rounded-lg p-3 min-w-0" style={{ "--challenge-stat-accent": hexToHsl(settings[key].color) } as CSSProperties}>
        <p className="text-xs font-semibold uppercase break-words">{settings[key].label}</p>
        <p className="text-lg font-bold break-words mt-1">{values[key]}</p>
      </div>)}
    </div>
    <div className="flex flex-wrap gap-2 mb-4 text-sm" style={{ "--challenge-stat-accent": hexToHsl(settings.espColor) } as CSSProperties}>
      {Object.keys(prizes).map(Number).sort((a, b) => a - b).map(rank => <span key={rank} className="challenge-prize px-3 py-1 rounded-full font-bold">#{rank} · {prizes[String(rank)]} ESP</span>)}
    </div>
  </>;
}