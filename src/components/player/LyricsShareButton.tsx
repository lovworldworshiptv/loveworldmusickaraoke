import { useState } from "react";
import { Quote, Copy, Share2, Lock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { isMedianApp, nativeShare, openExternal } from "@/lib/median";
import { logShareClick, tagShareUrl, type ShareChannel } from "@/lib/acquisitionAnalytics";
import { cardBaseUrl } from "@/lib/shareCard";
import { socialShareUrl, type SocialTarget } from "@/lib/socialShare";
import { WhatsAppIcon, TelegramIcon } from "@/components/share/SocialIcons";
import kingschatLogo from "@/assets/kingschat_logo.png";

interface Props {
  song: { id: string; title: string; artist?: string | null };
  lyrics: string;
  isPremium: boolean;
  onUpgrade: () => void;
}

/** Builds the shared lyrics message: title, the lyrics, then the song link. */
export const lyricsMessage = (title: string, artist: string | null | undefined, lyrics: string) =>
  `"${title}"${artist ? ` — ${artist}` : ""}\n\n${lyrics.trim()}`;

const item = "flex items-center gap-2.5 w-full px-2 py-2 rounded-md text-sm text-foreground hover:bg-accent transition-colors";

/** Copy or share a song's lyrics. Premium (and trial) listeners only; others see the upgrade offer. */
const LyricsShareButton = ({ song, lyrics, isPremium, onUpgrade }: Props) => {
  const [open, setOpen] = useState(false);
  const base = cardBaseUrl({ kind: "song", id: song.id, title: song.title });
  const message = lyricsMessage(song.title, song.artist, lyrics);
  const link = (channel: ShareChannel) => { const l = tagShareUrl(base, channel); logShareClick(channel, l); return l; };
  const go = (url: string) => (isMedianApp() ? openExternal(url) : window.open(url, "_blank", "noopener,noreferrer"));

  const copy = async () => {
    try {
      logShareClick("copy", base);
      await navigator.clipboard.writeText(lyrics.trim());
      toast.success("Lyrics copied");
    } catch {
      toast.error("Couldn't copy the lyrics on this device");
    }
    setOpen(false);
  };
  const shareNative = () => {
    const l = link("native");
    setOpen(false);
    if (nativeShare(l, message)) return;
    if (navigator.share) navigator.share({ title: song.title, text: message, url: l }).catch(() => {});
    else copy();
  };
  const social = (target: SocialTarget) => () => { setOpen(false); go(socialShareUrl(target, link(target), message)); };

  const trigger = (
    <button
      type="button"
      onClick={isPremium ? undefined : onUpgrade}
      aria-label={isPremium ? "Copy or share lyrics" : "Copy or share lyrics (Premium)"}
      title={isPremium ? "Copy or share lyrics" : "Premium: copy or share lyrics"}
      className="relative flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-secondary/80 text-foreground hover:bg-secondary transition-colors"
    >
      <Quote className="w-4 h-4" />
      {!isPremium && <Lock className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 p-0.5 rounded-full bg-gold text-primary-foreground" aria-hidden="true" />}
    </button>
  );

  if (!isPremium) return trigger;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="end">
        <p className="text-xs font-semibold text-foreground px-2 py-1.5">Lyrics</p>
        <div className="space-y-0.5">
          <button onClick={copy} className={item}><Copy className="w-4 h-4 text-gold" aria-hidden="true" /> Copy lyrics</button>
          <button onClick={shareNative} className={item}><Share2 className="w-4 h-4 text-gold" aria-hidden="true" /> Share lyrics</button>
          <div className="border-t border-border my-1" />
          <button onClick={social("whatsapp")} className={item}><WhatsAppIcon /> WhatsApp</button>
          <button onClick={social("kingschat")} className={item}><img src={kingschatLogo} alt="" className="w-4 h-4 rounded-sm" /> KingsChat</button>
          <button onClick={social("telegram")} className={item}><TelegramIcon /> Telegram</button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default LyricsShareButton;
