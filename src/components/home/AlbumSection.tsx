import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePlayer, type PlayerSong } from "@/contexts/PlayerContext";
import { Play, Disc3 } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Album {
  id: string;
  title: string;
  artist: string;
  cover_url: string | null;
  songCount: number;
}

const AlbumSection = () => {
  const [albums, setAlbums] = useState<Album[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAlbums = async () => {
      const { data: albumData } = await supabase
        .from("albums")
        .select("*")
        .eq("is_top", true)
        .order("created_at", { ascending: false });

      if (!albumData || albumData.length === 0) return;

      // Get song counts per album
      const albumIds = albumData.map(a => a.id);
      const { data: songData } = await supabase
        .from("songs")
        .select("album_id")
        .in("album_id", albumIds);

      const countMap: Record<string, number> = {};
      (songData || []).forEach(s => {
        if (s.album_id) countMap[s.album_id] = (countMap[s.album_id] || 0) + 1;
      });

      setAlbums(albumData.map(a => ({
        id: a.id, title: a.title, artist: a.artist, cover_url: a.cover_url,
        songCount: countMap[a.id] || 0,
      })));
    };
    fetchAlbums();
  }, []);

  if (albums.length === 0) return null;

  return (
    <section className="px-4 lg:px-6 mt-8 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-serif font-bold text-foreground">Top Albums</h3>
        <button onClick={() => navigate("/albums")} className="text-xs text-gold hover:text-gold-light font-medium transition-colors duration-200">See All</button>
      </div>
      <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-1 px-1">
        {albums.map((album, i) => (
          <button
            key={album.id}
            onClick={() => navigate(`/albums?id=${album.id}`)}
            className="group flex-shrink-0 w-40 md:w-44 text-left animate-fade-in-up"
            style={{ animationDelay: `${i * 0.07}s` }}
          >
            <div className="relative aspect-square rounded-xl overflow-hidden mb-3 glass-card transition-all duration-300 group-hover:shadow-[0_8px_32px_hsl(43_70%_53%/0.12)]">
              {album.cover_url ? (
                <img src={album.cover_url} alt={album.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
              ) : (
                <div className="w-full h-full gradient-purple flex items-center justify-center">
                  <Disc3 className="w-10 h-10 text-gold/30" />
                </div>
              )}
              <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-gold via-gold-light to-gold flex items-center justify-center shadow-[0_4px_20px_hsl(43_70%_53%/0.5)] backdrop-blur-sm ring-2 ring-white/20 hover:scale-110 transition-transform duration-200">
                  <Play className="w-4.5 h-4.5 text-white ml-0.5 drop-shadow-sm" fill="currentColor" />
                </div>
              </div>
            </div>
            <p className="text-sm font-medium text-foreground truncate group-hover:text-gold transition-colors duration-200">{album.title}</p>
            <p className="text-xs text-muted-foreground truncate">{album.artist} • {album.songCount} songs</p>
          </button>
        ))}
      </div>
    </section>
  );
};

export default AlbumSection;
