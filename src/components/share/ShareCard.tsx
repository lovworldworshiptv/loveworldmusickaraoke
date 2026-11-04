import { useEffect, useState } from "react";
import { Download, Share2, Copy, Check, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { isMedianApp, nativeShare, openExternal } from "@/lib/median";
import { logShareClick } from "@/lib/acquisitionAnalytics";
import { APP_DOWNLOAD_URL } from "@/components/share/AppDownloadPrompt";
import { CARD_STYLES, cardBaseUrl, cardFilename, cardLink, readCardStyle, saveCardStyle, type ShareCardFormat, type ShareCardItem, type ShareCardStyle } from "@/lib/shareCard";
import logoUrl from "@/assets/logo.png";
import kingschatLogo from "@/assets/kingschat_logo.png";
import { WhatsAppIcon, XIcon, FacebookIcon, TelegramIcon } from "@/components/share/SocialIcons";

interface ShareCardSheetProps {
  item: ShareCardItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const btn = "min-h-11 flex items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:opacity-50";

const ShareCardSheet = ({ item, open, onOpenChange }: ShareCardSheetProps) => {
  const [format, setFormat] = useState<ShareCardFormat>("story");
  const [style, setStyle] = useState<ShareCardStyle>(readCardStyle);
  const pickStyle = (s: ShareCardStyle) => { setStyle(s); saveCardStyle(s); };
  const [blob, setBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const link = cardLink(item);
  const text = `Listen to "${item.title}"${item.subtitle ? ` by ${item.subtitle}` : ""} on Loveworld Music+`;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let url: string | null = null;
    setBlob(null); setPreview(null); setFailed(false);
    import("@/lib/shareCardRender")
      .then(({ renderShareCard }) => renderShareCard(item, format, style, link, logoUrl))
      .then((canvas) => new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png")))
      .then((b) => {
        if (cancelled) return;
        if (!b) { setFailed(true); return; }
        url = URL.createObjectURL(b);
        setBlob(b); setPreview(url);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [open, format, style, item.id, item.kind, item.title, item.subtitle, item.coverUrl, link]);

  const log = () => logShareClick("qr_card", cardBaseUrl(item));

  const download = () => {
    if (!preview) return;
    const a = document.createElement("a");
    a.href = preview;
    a.download = cardFilename(item.title);
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  const save = () => { if (!preview) return; log(); download(); toast.success("Image saved"); };

  // Spotify-style status/story share: the card image goes to the phone's share sheet
  // (WhatsApp Status, Instagram/Facebook Stories, Snapchat…) and the link is copied
  // at the same moment so it can be pasted as a link sticker or caption.
  const shareStatus = () => {
    log();
    if (isMedianApp()) { nativeShare(link, text); return; }
    if (!blob) return;
    const file = new File([blob], cardFilename(item.title), { type: "image/png" });
    navigator.clipboard?.writeText(link).catch(() => {});
    if (navigator.canShare?.({ files: [file] })) {
      navigator.share({ files: [file], title: item.title, text: `${text}\n${link}` })
        .then(() => toast.success("Shared! The link is copied — paste it as a link sticker on your story."))
        .catch(() => { /* cancelled */ });
    } else {
      download();
      toast.success("Card saved and link copied. Post the image to your status or story, then paste the link.");
    }
  };

  const go = (target: string) => (isMedianApp() ? openExternal(target) : window.open(target, "_blank", "noopener,noreferrer"));
  const msg = encodeURIComponent(`${text}\n\nGet the app: ${APP_DOWNLOAD_URL}`);
  const kingschat = () => { log(); go(`https://kingschat.online/?share=${encodeURIComponent(link)}&text=${msg}`); };
  const whatsapp = () => { log(); go(`https://wa.me/?text=${msg}%0A${encodeURIComponent(link)}`); };
  const facebook = () => { log(); go(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`); };
  const twitter = () => { log(); go(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`); };
  const telegram = () => { log(); go(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`); };
  const copy = async () => {
    log();
    await navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success("Link copied");
    setTimeout(() => setCopied(false), 2000);
  };

  const ready = !!preview;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onClick={(e) => e.stopPropagation()}
        className="max-w-md w-full max-h-[100dvh] overflow-y-auto overflow-x-hidden p-4 sm:p-6 max-sm:top-auto max-sm:bottom-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-3xl motion-reduce:animate-none"
      >
        <DialogHeader>
          <DialogTitle className="font-serif">Share card</DialogTitle>
          <DialogDescription>Anyone can scan the code with their phone camera to open “{item.title}”.</DialogDescription>
        </DialogHeader>

        <div role="radiogroup" aria-label="Card style" className="grid grid-cols-2 gap-1 rounded-xl bg-muted/50 p-1">
          {CARD_STYLES.map((s) => (
            <button key={s.id} role="radio" aria-checked={style === s.id} onClick={() => pickStyle(s.id)}
              className={cn(btn, "min-h-10 font-serif", style === s.id ? "bg-gold text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              {s.label}
            </button>
          ))}
        </div>

        <div role="radiogroup" aria-label="Card shape" className="grid grid-cols-3 gap-1 rounded-xl bg-muted/50 p-1">
          {(["story", "portrait", "square"] as const).map((f) => (
            <button key={f} role="radio" aria-checked={format === f} onClick={() => setFormat(f)}
              className={cn(btn, "min-h-10", format === f ? "bg-gold text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              {f === "story" ? "Story" : f === "portrait" ? "Portrait" : "Square"}
            </button>
          ))}
        </div>

        <div className={cn("mx-auto w-full overflow-hidden rounded-2xl bg-muted/40 flex items-center justify-center", format === "story" ? "aspect-[9/16] max-w-[230px]" : format === "portrait" ? "aspect-[4/5] max-w-[300px]" : "aspect-square max-w-[300px]")}>
          {preview ? (
            <img src={preview} alt={`Share card for ${item.title}`} className="w-full h-full object-contain" />
          ) : failed ? (
            <p className="p-4 text-center text-sm text-muted-foreground">The card couldn't be made. You can still copy the link below.</p>
          ) : (
            <span className="flex items-center gap-2 text-sm text-muted-foreground" role="status"><Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" /> Making your card…</span>
          )}
        </div>

        <div className="space-y-1.5">
          <button onClick={shareStatus} disabled={!ready && !isMedianApp()} className={cn(btn, "w-full bg-gradient-to-br from-gold via-gold-light to-gold text-primary-foreground")}>
            <Share2 className="w-4 h-4" aria-hidden="true" /> Share to status or story
          </button>
          <p className="text-xs text-muted-foreground text-center">WhatsApp Status, Instagram, Facebook, Snapchat and more. The link is copied for you to paste as a link sticker.</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button onClick={kingschat} className={cn(btn, "bg-muted/60 text-foreground hover:bg-muted")}>
            <img src={kingschatLogo} alt="" className="w-4 h-4 rounded-sm" /> KingsChat
          </button>
          <button onClick={whatsapp} className={cn(btn, "bg-muted/60 text-foreground hover:bg-muted")}><WhatsAppIcon /> WhatsApp</button>
          <button onClick={facebook} className={cn(btn, "bg-muted/60 text-foreground hover:bg-muted")}><FacebookIcon /> Facebook</button>
          <button onClick={twitter} className={cn(btn, "bg-muted/60 text-foreground hover:bg-muted")}><XIcon /> X</button>
          <button onClick={telegram} className={cn(btn, "bg-muted/60 text-foreground hover:bg-muted")}><TelegramIcon /> Telegram</button>
          <button onClick={copy} className={cn(btn, "bg-muted/60 text-foreground hover:bg-muted")}>
            {copied ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />} {copied ? "Copied" : "Copy link"}
          </button>
          <button onClick={save} disabled={!ready} className={cn(btn, "col-span-3 border border-gold/50 text-foreground hover:bg-gold/10")}>
            <Download className="w-4 h-4" aria-hidden="true" /> Save image
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareCardSheet;
