import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import ImageUploadPicker from "@/components/admin/ImageUploadPicker";
import GameHubCard from "@/components/games/GameHubCard";
import { GAME_CARD_DEFAULTS, CHALLENGE_STATS_DEFAULTS, CHALLENGE_STAT_KEYS, resolveChallengeStats, resolveGameCard, type ChallengeStatsSettings, type GameCardKey, type GameCardPresentation, type GameCardSettings } from "@/lib/gameCards";
import ChallengeStats from "@/components/games/ChallengeStats";
import { useActiveChallenge, useParticipantCount } from "@/hooks/useChallenge";
import { getSetting, saveSetting, SETTING_KEYS } from "@/lib/siteSettings";

export default function GameCardsEditor() {
  const [cards, setCards] = useState<Record<GameCardKey, GameCardPresentation>>(GAME_CARD_DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<ChallengeStatsSettings>(CHALLENGE_STATS_DEFAULTS);
  const { data: challenge } = useActiveChallenge();
  const { data: participants } = useParticipantCount(challenge?.id);
  useEffect(() => { getSetting<GameCardSettings>(SETTING_KEYS.gameCards).then(value => {
    setCards({ songmatch: resolveGameCard("songmatch", value), articles: resolveGameCard("articles", value), challenge: resolveGameCard("challenge", value) }); setStats(resolveChallengeStats(value)); setLoaded(true);
  }); }, []);
  function update(key: GameCardKey, patch: Partial<GameCardPresentation>) {
    setCards(value => ({ ...value, [key]: { ...value[key], ...patch } }));
  }
  async function save() {
    setSaving(true);
    const { error } = await saveSetting(SETTING_KEYS.gameCards, { ...cards, challengeStats: stats });
    setSaving(false);
    if (error) toast.error("Could not save game cards. Please try again.");
    else toast.success("Game cards saved");
  }
  return <section className="mb-8 space-y-4">
    <h3 className="text-xl font-bold">Game Cards</h3>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {(["songmatch", "articles", "challenge"] as const).map(key => <div key={key} className="space-y-4 min-w-0">
        <GameHubCard fallbackImageUrl={GAME_CARD_DEFAULTS[key].imageUrl} presentation={key === "challenge" ? { ...cards[key], title: cards[key].title || "Challenges", description: cards[key].description || "Uses the current challenge description" } : cards[key]} tag={key === "songmatch" ? "Music quiz" : key === "challenge" ? "Song Master Challenge" : "Knowledge quiz"} />
        <label className="block text-sm space-y-1"><span>{key === "challenge" ? "Challenge card title" : "Title"}</span><input placeholder={key === "challenge" ? "Use current challenge name" : undefined} maxLength={80} value={cards[key].title} onChange={event => update(key, { title: event.target.value })} className="w-full rounded-lg border bg-muted p-2 text-foreground" /></label>
        <label className="block text-sm space-y-1"><span>{key === "challenge" ? "Challenge card description" : "Description"}</span><textarea placeholder={key === "challenge" ? "Use current challenge description" : undefined} maxLength={300} value={cards[key].description} onChange={event => update(key, { description: event.target.value })} className="w-full rounded-lg border bg-muted p-2 text-foreground" /></label>
        <label className="flex items-center gap-3 text-sm">Background colour<input aria-label={`${key} background colour`} type="color" value={cards[key].color} onChange={event => update(key, { color: event.target.value })} className="h-10 w-12 rounded border cursor-pointer" /></label>
        <ImageUploadPicker bucket="game-images" label="Card Photo" value={cards[key].imageUrl} onChange={imageUrl => update(key, { imageUrl })} />
        {key === "challenge" && <div className="space-y-4">
          <h4 className="text-lg font-bold">Challenge figures</h4>
          {challenge && <ChallengeStats settings={stats} values={{ prizePool: `${challenge.prize_pool} Espees`, entryFee: Number(challenge.entry_fee) <= 0 ? "Free" : `${challenge.entry_fee} Espees`, players: participants ?? 0, topPrize: `${challenge.prize_distribution?.["1"] ?? 0} ESP` }} prizes={challenge.prize_distribution || {}} />}
          {CHALLENGE_STAT_KEYS.map(statKey => <div key={statKey} className="flex items-end gap-3">
            <label className="block text-sm space-y-1 flex-1 min-w-0"><span>{CHALLENGE_STATS_DEFAULTS[statKey].label} label</span><input maxLength={40} value={stats[statKey].label} onChange={event => setStats(value => ({ ...value, [statKey]: { ...value[statKey], label: event.target.value } }))} className="w-full rounded-lg border bg-muted p-2 text-foreground" /></label>
            <input aria-label={`${CHALLENGE_STATS_DEFAULTS[statKey].label} colour`} type="color" value={stats[statKey].color} onChange={event => setStats(value => ({ ...value, [statKey]: { ...value[statKey], color: event.target.value } }))} className="h-10 w-12 shrink-0 rounded border cursor-pointer" />
          </div>)}
          <label className="flex items-center gap-3 text-sm">ESP amounts colour<input aria-label="ESP amounts colour" type="color" value={stats.espColor} onChange={event => setStats(value => ({ ...value, espColor: event.target.value }))} className="h-10 w-12 rounded border cursor-pointer" /></label>
        </div>}
      </div>)}
    </div>
    <Button disabled={!loaded || saving} onClick={save} className="gap-2"><Save className="w-4 h-4" />{saving ? "Saving…" : "Save Game Cards"}</Button>
  </section>;
}