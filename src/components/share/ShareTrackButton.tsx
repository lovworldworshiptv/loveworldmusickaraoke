import { Share2 } from "lucide-react";
import ShareMenu, { buildShareUrl } from "@/components/share/ShareMenu";

export interface ShareTrack {
  id: string;
  title: string;
  artist?: string | null;
  coverUrl?: string | null;
}

export function buildTrackShareUrl(track: ShareTrack) {
  const slug = (track.title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return buildShareUrl(`/library?song=${track.id}&title=${slug}`);
}

interface ShareTrackButtonProps {
  track: ShareTrack;
  className?: string;
  iconClassName?: string;
  trigger?: React.ReactNode;
  ariaLabel?: string;
}

const ShareTrackButton = ({ track, className, iconClassName, trigger, ariaLabel }: ShareTrackButtonProps) => (
  <ShareMenu
    url={buildTrackShareUrl(track)}
    title={track.title}
    text={`Listen to "${track.title}"${track.artist ? ` by ${track.artist}` : ""} on Loveworld Music Karaoke+`}
    imageUrl={track.coverUrl || undefined}
    kingschatFirst
    trigger={
      <button
        type="button"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        aria-label={ariaLabel || `Share ${track.title}`}
        className={className || "p-1 text-muted-foreground hover:text-gold transition-colors"}
      >
        {trigger || <Share2 className={iconClassName || "w-4 h-4"} aria-hidden="true" />}
      </button>
    }
  />
);


export default ShareTrackButton;
