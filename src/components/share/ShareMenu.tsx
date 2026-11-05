import { useState, lazy, Suspense } from "react";
import { Share2, Mail, Copy, Check, QrCode, Lock } from "lucide-react";
import type { ShareCardItem } from "@/lib/shareCard";
const ShareCardSheet = lazy(() => import("@/components/share/ShareCard"));
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useIsPremium } from "@/hooks/useIsPremium";
import { nativeShare, openExternal, isMedianApp } from "@/lib/median";
import { APP_DOWNLOAD_URL } from "@/components/share/AppDownloadPrompt";
import kingschatLogo from "@/assets/kingschat_logo.png";
import { WhatsAppIcon, XIcon, FacebookIcon, TelegramIcon } from "@/components/share/SocialIcons";
import { socialShareUrl } from "@/lib/socialShare";
import { logShareClick, tagShareUrl, type ShareChannel } from "@/lib/acquisitionAnalytics";

interface ShareMenuProps {
  url: string;
  title: string;
  text?: string;
  /** Optional image URL for social previews */
  imageUrl?: string;
  /** Show KingsChat as first option */
  kingschatFirst?: boolean;
  /** Custom trigger element; defaults to a Share button */
  trigger?: React.ReactNode;
  /** When set, offers a "Share Card" image with a QR code. */
  card?: ShareCardItem;
}

const DOMAIN = "https://loveworldmusickaraoke.com";

export function buildShareUrl(path: string) {
  return `${DOMAIN}${path}`;
}

const ShareMenu = ({ url, title, text, imageUrl, kingschatFirst = false, trigger, card }: ShareMenuProps) => {
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const { isPremium } = useIsPremium();
  const navigate = useNavigate();
  const openCard = () => {
    setMenuOpen(false);
    if (!isPremium) {
      toast("Share Cards are a Premium feature.", { action: { label: "See plans", onClick: () => navigate("/subscription") } });
      return;
    }
    setCardOpen(true);
  };

  const shareText = `${text || title}\n\nGet the app: ${APP_DOWNLOAD_URL}`;
  /** Each channel gets its own tagged link so admins can see which channel brings people in. */
  const link = (channel: ShareChannel) => { logShareClick(channel, url); return tagShareUrl(url, channel); };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(link("copy"));
    setCopied(true);
    toast.success("Link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const open = (target: string) => {
    if (isMedianApp()) {
      openExternal(target);
    } else {
      window.open(target, "_blank", "noopener,noreferrer");
    }
  };

  const handleKingsChat = () => open(socialShareUrl("kingschat", link("kingschat"), shareText));
  const handleWhatsApp = () => open(socialShareUrl("whatsapp", link("whatsapp"), shareText));
  const handleTwitter = () => open(socialShareUrl("x", link("x"), text || title));
  const handleFacebook = () => open(socialShareUrl("facebook", link("facebook"), shareText));
  const handleTelegram = () => open(socialShareUrl("telegram", link("telegram"), shareText));
  const handleEmail = () => open(socialShareUrl("email", link("email"), imageUrl ? `${shareText}\n\n${imageUrl}` : shareText, title));

  const handleNative = () => {
    const shared = link("native");
    if (nativeShare(shared, shareText)) return;
    if (navigator.share) {
      navigator.share({ title, text: shareText, url: shared }).catch(() => {});
    }
  };

  const btnClass = "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-foreground hover:bg-gold/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold";
  const tile = (key: string, label: string, onClick: () => void, icon: React.ReactNode) => (
    <button key={key} onClick={onClick} className="group flex flex-col items-center gap-1.5 rounded-xl py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
      <span className="w-11 h-11 rounded-full glass border border-gold/25 flex items-center justify-center transition-all duration-200 group-hover:border-gold/60 group-hover:-translate-y-0.5 group-hover:shadow-[0_0_14px_hsl(var(--gold)/0.35)] group-active:scale-95">{icon}</span>
      <span className="text-[11px] leading-none text-foreground/90">{label}</span>
    </button>
  );

  const kcBtn = tile("kc", "KingsChat", handleKingsChat, <img src={kingschatLogo} alt="" className="w-5 h-5 rounded-sm" />);

  const socialBtns = [
    tile("wa", "WhatsApp", handleWhatsApp, <WhatsAppIcon />),
    tile("x", "X", handleTwitter, <XIcon />),
    tile("fb", "Facebook", handleFacebook, <FacebookIcon />),
    tile("tg", "Telegram", handleTelegram, <TelegramIcon />),
    tile("em", "Email", handleEmail, <Mail className="w-5 h-5 text-gold" />),
  ];

  const orderedBtns = kingschatFirst ? [kcBtn, ...socialBtns] : [...socialBtns.slice(0, 1), kcBtn, ...socialBtns.slice(1)];

  return (
    <>
    <Popover open={menuOpen} onOpenChange={setMenuOpen}>
      <PopoverTrigger asChild>
        {trigger || (
          <button className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-accent">
            <Share2 className="w-4 h-4" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3 rounded-2xl glass border-gold/25 shadow-[0_8px_32px_hsl(var(--gold)/0.18)]" align="end">
        <div className="flex items-center gap-3 px-1 pb-3">
          {imageUrl
            ? <img src={imageUrl} alt="" className="w-11 h-11 object-cover rounded-xl shrink-0" />
            : <span className="w-11 h-11 rounded-xl bg-gold/15 flex items-center justify-center shrink-0"><Share2 className="w-5 h-5 text-gold" /></span>}
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-gold font-semibold">Share</p>
            <p className="text-sm font-semibold text-foreground truncate">{title}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-y-2 pb-2">
          {orderedBtns}
        </div>
        <div className="space-y-0.5 border-t border-gold/15 pt-2">
          <button onClick={handleCopy} className={btnClass}>
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
            {copied ? "Copied!" : "Copy Link"}
          </button>
          {card && (
            <button onClick={(e) => { e.stopPropagation(); openCard(); }} className={btnClass}>
              <QrCode className="w-4 h-4 text-gold" aria-hidden="true" /> Share Card
              {!isPremium && <Lock className="w-3.5 h-3.5 ml-auto text-gold" aria-label="Premium" />}
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
    {card && cardOpen && isPremium && (
      <Suspense fallback={null}>
        <ShareCardSheet item={card} open={cardOpen} onOpenChange={setCardOpen} />
      </Suspense>
    )}
    </>
  );
};

export default ShareMenu;
