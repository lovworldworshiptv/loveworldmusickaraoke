import { useState } from "react";
import { ListMusic } from "lucide-react";

export default function PlaylistArtwork({ cover, name }: { cover: string | null; name: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return (
    <div className="w-11 h-11 shrink-0 rounded-lg overflow-hidden bg-primary/10 flex items-center justify-center">
      {cover && cover !== failedUrl ? <img src={cover} alt={`${name} artwork`} loading="lazy" className="w-full h-full object-cover" onError={() => setFailedUrl(cover)} /> : <ListMusic className="w-5 h-5 text-primary" />}
    </div>
  );
}