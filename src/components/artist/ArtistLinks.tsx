import { Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { matchArtists, useArtists } from "@/lib/artists";
import { usePlayer } from "@/contexts/PlayerContext";

interface Props { artist: string | null | undefined; className?: string }

/** Renders each known artist name as a link to its profile; never toggles playback. */
const ArtistLinks = ({ artist, className }: Props) => {
  const { data: artists = [] } = useArtists();
  const navigate = useNavigate();
  const { isExpanded, toggleExpanded } = usePlayer();
  if (!artist) return null;
  const parts = matchArtists(artist, artists);
  if (!parts.some((p) => p.artist)) return <span className={className}>{artist}</span>;
  return (
    <span className={className}>
      {parts.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && ", "}
          {p.artist ? (
            <a
              href={`/artist/${p.artist.slug}`}
              className="hover:underline focus-visible:underline focus-visible:outline-none"
              onClick={(e) => {
                e.preventDefault(); e.stopPropagation();
                if (isExpanded) toggleExpanded();
                navigate(`/artist/${p.artist!.slug}`);
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >{p.name}</a>
          ) : p.name}
        </Fragment>
      ))}
    </span>
  );
};

export default ArtistLinks;
