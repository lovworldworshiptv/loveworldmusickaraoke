import { Share2 } from "lucide-react";
import ShareMenu, { buildShareUrl } from "@/components/share/ShareMenu";

interface ShareInviteButtonProps {
  article: { id: string; title: string; excerpt: string | null };
}

const ShareInviteButton = ({ article }: ShareInviteButtonProps) => {
  const slug = article.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const shareUrl = buildShareUrl(`/articles?id=${article.id}&title=${slug}`);

  return (
    <ShareMenu
      url={shareUrl}
      title={article.title}
      text={`Read "${article.title}" with me!`}
      kingschatFirst
      trigger={
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-gold/10 text-gold hover:bg-gold/20 transition-colors">
          <Share2 className="w-3.5 h-3.5" /> Invite
        </button>
      }
    />
  );
};

export default ShareInviteButton;
