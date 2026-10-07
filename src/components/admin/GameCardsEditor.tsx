import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import ImageUploadPicker from "@/components/admin/ImageUploadPicker";
import GameHubCard from "@/components/games/GameHubCard";
import { GAME_CARD_DEFAULTS, resolveGameCard, type GameCardKey, type GameCardPresentation, type GameCardSettings } from "@/lib/gameCards";
import { getSetting, saveSetting, SETTING_KEYS } from "@/lib/siteSettings";

export default function GameCardsEditor() {
  const [cards, setCards] = useState<Record<GameCardKey, GameCardPresentation>>(GAME_CARD_DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => { getSetting<GameCardSettings>(SETTING_KEYS.gameCards).then(value => {
    setCards({ songmatch: resolveGameCard("songmatch", value), articles: resolveGameCard("articles", value) }); setLoaded(true);
  }); }, []);
  function update(key: GameCardKey, patch: Partial<GameCardPresentation>) {
    setCards(value => ({ ...value, [key]: { ...value[key], ...patch } }));
  }
  async function save() {
    setSaving(true);
    const { error } = await saveSetting(SETTING_KEYS.gameCards, cards);
    setSaving(false);
    if (error) toast.error("Could not save game cards. Please try again.");
    else toast.success("Game cards saved");
  }
  return <section className="mb-8 space-y-4">
    <h3 className="text-xl font-bold">Game Cards</h3>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {(["songmatch", "articles"] as const).map(key => <div key={key} className="space-y-4 min-w-0">
        <GameHubCard presentation={cards[key]} tag={key === "songmatch" ? "Music quiz" : "Knowledge quiz"} />
        <label className="block text-sm space-y-1"><span>Title</span><input maxLength={80} value={cards[key].title} onChange={event => update(key, { title: event.target.value })} className="w-full rounded-lg border bg-muted p-2 text-foreground" /></label>
        <label className="block text-sm space-y-1"><span>Description</span><textarea maxLength={300} value={cards[key].description} onChange={event => update(key, { description: event.target.value })} className="w-full rounded-lg border bg-muted p-2 text-foreground" /></label>
        <label className="flex items-center gap-3 text-sm">Background colour<input aria-label={`${key} background colour`} type="color" value={cards[key].color} onChange={event => update(key, { color: event.target.value })} className="h-10 w-12 rounded border cursor-pointer" /></label>
        <ImageUploadPicker bucket="game-images" label="Card Photo" value={cards[key].imageUrl} onChange={imageUrl => update(key, { imageUrl })} />
      </div>)}
    </div>
    <Button disabled={!loaded || saving} onClick={save} className="gap-2"><Save className="w-4 h-4" />{saving ? "Saving…" : "Save Game Cards"}</Button>
  </section>;
}