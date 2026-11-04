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

  const btnClass = "flex items-center gap-2.5 w-full px-2 py-2 rounded-md text-sm text-foreground hover:bg-accent transition-colors";

  const kcBtn = (
    <button key="kc" onClick={handleKingsChat} className={btnClass}>
      <img src={kingschatLogo} alt="KingsChat" className="w-4 h-4 rounded-sm" /> KingsChat
    </button>
  );

  const socialBtns = [
    <button key="wa" onClick={handleWhatsApp} className={btnClass}>
      <WhatsAppIcon /> WhatsApp
    </button>,
    <button key="x" onClick={handleTwitter} className={btnClass}>
      <XIcon /> X (Twitter)
    </button>,
    <button key="fb" onClick={handleFacebook} className={btnClass}>
      <FacebookIcon /> Facebook
    </button>,
    <button key="tg" onClick={handleTelegram} className={btnClass}>
      <TelegramIcon /> Telegram
    </button>,
    <button key="em" onClick={handleEmail} className={btnClass}>
      <Mail className="w-4 h-4 text-gold" /> Email
    </button>,
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
      <PopoverContent className="w-56 p-2" align="end">
        {imageUrl && (
          <div className="px-2 pb-2">
            <img src={imageUrl} alt={title} className="w-full h-20 object-cover rounded-md" />
            <p className="text-xs font-semibold text-foreground mt-1 truncate">{title}</p>
          </div>
        )}
        {!imageUrl && <p className="text-xs font-semibold text-foreground px-2 py-1.5">Share</p>}
        <div className="space-y-0.5">
          {orderedBtns}
          <div className="border-t border-border my-1" />
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
