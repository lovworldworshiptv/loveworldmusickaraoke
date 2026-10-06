import { useEffect, useState } from "react";
import { Check, Languages } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer } from "@/contexts/PlayerContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface LyricRow { language_code: string; lyrics_lrc: string | null; lyrics_text: string | null; is_machine_translated: boolean }
interface Lang { code: string; name: string; native_name: string | null }

/** Language button + bottom sheet to switch lyrics translation for the current song. */
const LyricsLanguageSheet = () => {
  const { currentSong, applyLyrics } = usePlayer();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<LyricRow[]>([]);
  const [langs, setLangs] = useState<Record<string, Lang>>({});
  const [active, setActive] = useState("en");

  useEffect(() => {
    setActive("en");
    setRows([]);
    if (!currentSong) return;
    supabase.from("song_lyrics").select("language_code, lyrics_lrc, lyrics_text, is_machine_translated")
      .eq("song_id", currentSong.id)
      .then(({ data }) => setRows((data as LyricRow[]) || []));
  }, [currentSong?.id]);

  useEffect(() => {
    supabase.from("languages").select("code, name, native_name").eq("is_active", true)
      .then(({ data }) => {
        const map: Record<string, Lang> = {};
        (data as Lang[] | null)?.forEach((l) => { map[l.code] = l; });
        setLangs(map);
      });
  }, []);

  if (rows.length < 2) return null;

  const choose = (r: LyricRow) => {
    applyLyrics(r.lyrics_lrc, r.lyrics_text);
    setActive(r.language_code);
    setOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 px-3 py-2 rounded-full text-xs font-semibold bg-secondary/60 text-muted-foreground hover:text-foreground"
        aria-label="Lyrics language"
      >
        <Languages className="w-3.5 h-3.5" /> {active.toUpperCase()}
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl glass-card max-h-[70dvh] overflow-y-auto">
          <SheetHeader><SheetTitle className="font-serif">Lyrics language</SheetTitle></SheetHeader>
          <div className="mt-4 space-y-1">
            {rows.map((r) => {
              const l = langs[r.language_code];
              return (
                <button
                  key={r.language_code}
                  onClick={() => choose(r)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-left transition-colors ${active === r.language_code ? "bg-gold/15 text-gold" : "hover:bg-secondary/60 text-foreground"}`}
                >
                  <span>
                    <span className="font-medium">{l?.name || r.language_code.toUpperCase()}</span>
                    {l?.native_name && l.native_name !== l.name && <span className="ml-2 text-xs text-muted-foreground">{l.native_name}</span>}
                    {r.is_machine_translated && <span className="ml-2 text-[10px] text-muted-foreground">auto</span>}
                  </span>
                  {active === r.language_code && <Check className="w-4 h-4" />}
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default LyricsLanguageSheet;
