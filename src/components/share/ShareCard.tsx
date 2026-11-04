import { useEffect, useState } from "react";
import { Download, Share2, Copy, Check, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { isMedianApp, nativeShare, openExternal } from "@/lib/median";
import { logShareClick } from "@/lib/acquisitionAnalytics";
import { APP_DOWNLOAD_URL } from "@/components/share/AppDownloadPrompt";
import { cardBaseUrl, cardFilename, cardLink, type ShareCardFormat, type ShareCardItem } from "@/lib/shareCard";
import logoUrl from "@/assets/logo.png";
import kingschatLogo from "@/assets/kingschat_logo.png";

interface ShareCardSheetProps {
  item: ShareCardItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const btn = "min-h-11 flex items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:opacity-50";

const ShareCardSheet = ({ item, open, onOpenChange }: ShareCardSheetProps) => {
  const [format, setFormat] = useState<ShareCardFormat>("portrait");
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
      .then(({ renderShareCard }) => renderShareCard(item, format, link, logoUrl))
      .then((canvas) => new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png")))
      .then((b) => {
        if (cancelled) return;
        if (!b) { setFailed(true); return; }
        url = URL.createObjectURL(b);
        setBlob(b); setPreview(url);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [open, format, item.id, item.kind, item.title, item.subtitle, item.coverUrl, link]);

  const log = () => logShareClick("qr_card", cardBaseUrl(item));

  const save = () => {
    if (!preview) return;
    log();
    const a = document.createElement("a");
    a.href = preview;
    a.download = cardFilename(item.title);
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.success("Image saved");
  };

  const shareImage = async () => {
    if (isMedianApp()) { log(); nativeShare(link, text); return; }
    if (!blob) return;
    const file = new File([blob], cardFilename(item.title), { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      log();
      try { await navigator.share({ files: [file], title: item.title, text: `${text}\n${link}` }); } catch { /* cancelled */ }
    } else save();
  };

  const go = (target: string) => (isMedianApp() ? openExternal(target) : window.open(target, "_blank", "noopener,noreferrer"));
  const msg = encodeURIComponent(`${text}\n\nGet the app: ${APP_DOWNLOAD_URL}`);
  const kingschat = () => { log(); go(`https://kingschat.online/?share=${encodeURIComponent(link)}&text=${msg}`); };
  const whatsapp = () => { log(); go(`https://wa.me/?text=${msg}%0A${encodeURIComponent(link)}`); };
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

        <div role="radiogroup" aria-label="Card shape" className="grid grid-cols-2 gap-1 rounded-xl bg-muted/50 p-1">
          {(["portrait", "square"] as const).map((f) => (
            <button key={f} role="radio" aria-checked={format === f} onClick={() => setFormat(f)}
              className={cn(btn, "min-h-10", format === f ? "bg-gold text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              {f === "portrait" ? "Portrait" : "Square"}
            </button>
          ))}
        </div>

        <div className={cn("mx-auto w-full overflow-hidden rounded-2xl bg-muted/40 flex items-center justify-center", format === "portrait" ? "aspect-[4/5] max-w-[300px]" : "aspect-square max-w-[300px]")}>
          {preview ? (
            <img src={preview} alt={`Share card for ${item.title}`} className="w-full h-full object-contain" />
          ) : failed ? (
            <p className="p-4 text-center text-sm text-muted-foreground">The card couldn't be made. You can still copy the link below.</p>
          ) : (
            <span className="flex items-center gap-2 text-sm text-muted-foreground" role="status"><Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" /> Making your card…</span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button onClick={save} disabled={!ready} className={cn(btn, "bg-gradient-to-br from-gold via-gold-light to-gold text-primary-foreground")}>
            <Download className="w-4 h-4" aria-hidden="true" /> Save image
          </button>
          <button onClick={shareImage} disabled={!ready && !isMedianApp()} className={cn(btn, "border border-gold/50 text-foreground hover:bg-gold/10")}>
            <Share2 className="w-4 h-4" aria-hidden="true" /> Share image
          </button>
          <button onClick={kingschat} className={cn(btn, "bg-muted/60 text-foreground hover:bg-muted")}>
            <img src={kingschatLogo} alt="" className="w-4 h-4 rounded-sm" /> KingsChat
          </button>
          <button onClick={whatsapp} className={cn(btn, "bg-muted/60 text-foreground hover:bg-muted")}>WhatsApp</button>
          <button onClick={copy} className={cn(btn, "col-span-2 bg-muted/60 text-foreground hover:bg-muted")}>
            {copied ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />} {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareCardSheet;
