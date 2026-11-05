import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Crown, Music2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsPremium } from "@/hooks/useIsPremium";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useIsEditor } from "@/hooks/useIsEditor";
import { useFreeSongIds, isFreeSong } from "@/lib/freeSongs";
import { BREAK_SECONDS, countFinishedSong, isBreakExempt, isVideoUrl, setBreakGate } from "@/lib/playbackBreak";
import logo from "@/assets/logo.png";

interface BreakCard { id: string; title: string; subtitle: string | null; description: string | null; image_url: string | null; cta_text: string | null; link_url: string | null }

/** Full-screen 10-second break for free listeners; admin cards come from Premium Ads ("Playback Break"). */
const PlaybackBreak = () => {
  const navigate = useNavigate();
  const { isPremium, isTrial, resolved } = useIsPremium();
  const { isAdmin, loading: aL } = useIsAdmin();
  const { isEditor, loading: eL } = useIsEditor();
  const freeIds = useFreeSongIds();
  const [cards, setCards] = useState<BreakCard[]>([]);
  const [active, setActive] = useState<BreakCard | null | undefined>(undefined); // undefined = no break
  const [left, setLeft] = useState(BREAK_SECONDS);
  const countRef = useRef(0);
  const doneRef = useRef<((go: boolean) => void) | null>(null);
  const state = useRef({ exempt: true, freeIds, cards });
  state.current = { exempt: !resolved || aL || eL || isBreakExempt({ isPremium, isTrial, isEditor, isAdmin }), freeIds, cards };

  useEffect(() => {
    supabase.from("premium_ads").select("id,title,subtitle,description,image_url,cta_text,link_url")
      .eq("is_active", true).eq("placement", "playback_break").order("sort_order")
      .then(({ data }) => setCards((data as BreakCard[]) ?? []));
  }, []);

  useEffect(() => {
    setBreakGate((song) => {
      const s = state.current;
      if (s.exempt) return Promise.resolve(true);
      const r = countFinishedSong(countRef.current, isFreeSong(song, s.freeIds));
      countRef.current = r.count;
      if (!r.breakNow) return Promise.resolve(true);
      const pick = s.cards.length ? s.cards[Math.floor(Math.random() * s.cards.length)] : null;
      return new Promise<boolean>((resolve) => {
        const end = Date.now() + BREAK_SECONDS * 1000;
        setLeft(BREAK_SECONDS);
        setActive(pick);
        const tick = window.setInterval(() => {
          const sec = Math.max(0, Math.ceil((end - Date.now()) / 1000));
          setLeft(sec);
          if (sec <= 0) finish(true);
        }, 250);
        const finish = (go: boolean) => {
          window.clearInterval(tick);
          doneRef.current = null;
          setActive(undefined);
          resolve(go);
        };
        doneRef.current = finish;
      });
    });
    return () => setBreakGate(null);
  }, []);

  if (active === undefined) return null;

  const goPremium = () => {
    const link = active?.link_url || "/subscription";
    doneRef.current?.(false);
    if (/^https?:\/\//.test(link)) window.open(link, "_blank", "noopener"); else navigate(link);
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Short break" className="fixed inset-0 z-[200] flex items-center justify-center bg-background/95 backdrop-blur-md p-4">
      {active ? (
        <div className="relative w-full max-w-md max-h-full flex flex-col items-center gap-4">
          {isVideoUrl(active.image_url) ? (
            <video src={active.image_url!} autoPlay muted playsInline loop className="w-full max-h-[70dvh] object-contain rounded-2xl" />
          ) : active.image_url ? (
            <img src={active.image_url} alt={active.title} className="w-full max-h-[70dvh] object-contain rounded-2xl" />
          ) : (
            <div className="text-center"><h2 className="text-2xl font-bold text-foreground">{active.title}</h2>{active.description && <p className="text-muted-foreground mt-2">{active.description}</p>}</div>
          )}
          <button onClick={goPremium} className="w-full rounded-full py-3.5 font-bold gold-gradient text-primary-foreground shadow-lg">{active.cta_text || "Go Premium"}</button>
          <p className="text-sm font-semibold text-foreground">Music resumes in {left}s</p>
        </div>
      ) : (
        <div className="relative w-full max-w-sm overflow-hidden rounded-t-[999px] rounded-b-2xl border-4 border-primary bg-card shadow-2xl">
          <div className="bg-[hsl(40_33%_95%)] px-6 pt-20 pb-10 text-center">
            <div className="flex items-center justify-center gap-2">
              <img src={logo} alt="" className="h-9 w-9 rounded-lg" />
              <span className="font-bold text-[hsl(225_55%_15%)]">Loveworld Music<sup>+</sup> <span className="font-normal text-[hsl(225_15%_40%)]">Premium</span></span>
            </div>
            <h2 className="mt-6 text-3xl font-extrabold leading-tight text-[hsl(225_55%_15%)]">Worship without interruptions</h2>
            <p className="mt-3 text-[hsl(225_15%_30%)]">Go Premium for non-stop listening, karaoke, video, Stage Mode and offline downloads.</p>
          </div>
          <div className="relative gold-gradient px-6 pb-6 pt-10 text-center">
            <button onClick={goPremium} className="absolute -top-7 left-6 right-6 rounded-full bg-[hsl(225_55%_20%)] py-4 text-lg font-bold text-primary shadow-xl">Go Premium</button>
            <Music2 className="absolute -top-6 -right-1 h-12 w-12 rounded-full bg-primary p-2.5 text-[hsl(225_55%_15%)] ring-4 ring-[hsl(40_33%_95%)]" />
            <p className="text-lg font-bold text-[hsl(225_55%_15%)]">Music resumes in {left}s</p>
          </div>
          <div className="bg-[hsl(225_55%_12%)] px-6 py-5 text-center">
            <p className="flex items-center justify-center gap-2 font-semibold text-foreground"><Crown className="h-5 w-5 text-primary" /> Premium from 2 Espees a month</p>
            <p className="mt-1 text-sm text-foreground/80">3-day free trial available. Espees or bank transfer.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlaybackBreak;
