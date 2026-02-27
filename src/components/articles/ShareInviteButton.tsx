import { useState } from "react";
import { Share2, Mail, Copy, Check } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { toast } from "sonner";
import { nativeShare, openExternal, isMedianApp } from "@/lib/median";

interface ShareInviteButtonProps {
  article: { id: string; title: string; excerpt: string | null };
}

const ShareInviteButton = ({ article }: ShareInviteButtonProps) => {
  const [copied, setCopied] = useState(false);

  const slug = article.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const shareUrl = `https://loveworldmusickaraoke.com/articles?id=${article.id}&title=${slug}`;
  const shareText = `Read "${article.title}" with me!`;
  const emailSubject = encodeURIComponent(`Let's study together: ${article.title}`);
  const emailBody = encodeURIComponent(`Hi!\n\nI'd love for you to read this article with me:\n\n"${article.title}"\n${article.excerpt || ""}\n\nRead it here: ${shareUrl}\n\nBlessings!`);

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("Link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEmailInvite = () => {
    openExternal(`mailto:?subject=${emailSubject}&body=${emailBody}`);
  };

  const handleWhatsApp = () => {
    openExternal(`https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`);
  };

  const handleTwitter = () => {
    openExternal(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`);
  };

  const handleFacebook = () => {
    openExternal(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`);
  };

  const handleNativeShare = () => {
    if (nativeShare(shareUrl, shareText)) return;
    // Fallback to Web Share API
    if (navigator.share) {
      navigator.share({ title: article.title, text: shareText, url: shareUrl }).catch(() => {});
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-gold/10 text-gold hover:bg-gold/20 transition-colors">
          <Share2 className="w-3.5 h-3.5" /> Invite
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="end">
        <p className="text-xs font-semibold text-foreground px-2 py-1.5">Share & Invite</p>
        <div className="space-y-0.5">
          <button onClick={handleEmailInvite} className="flex items-center gap-2.5 w-full px-2 py-2 rounded-md text-sm text-foreground hover:bg-accent transition-colors">
            <Mail className="w-4 h-4 text-gold" /> Invite via Email
          </button>
          <button onClick={handleWhatsApp} className="flex items-center gap-2.5 w-full px-2 py-2 rounded-md text-sm text-foreground hover:bg-accent transition-colors">
            <svg className="w-4 h-4 text-green-500" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.612.638l4.694-1.222A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.153 0-4.159-.655-5.824-1.776a.5.5 0 00-.393-.063l-3.235.842.97-3.065a.5.5 0 00-.079-.447A9.946 9.946 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/></svg>
            WhatsApp
          </button>
          <button onClick={handleTwitter} className="flex items-center gap-2.5 w-full px-2 py-2 rounded-md text-sm text-foreground hover:bg-accent transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            X (Twitter)
          </button>
          <button onClick={handleFacebook} className="flex items-center gap-2.5 w-full px-2 py-2 rounded-md text-sm text-foreground hover:bg-accent transition-colors">
            <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            Facebook
          </button>
          <div className="border-t border-border my-1" />
          <button onClick={handleCopyLink} className="flex items-center gap-2.5 w-full px-2 py-2 rounded-md text-sm text-foreground hover:bg-accent transition-colors">
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
            {copied ? "Copied!" : "Copy Link"}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ShareInviteButton;
