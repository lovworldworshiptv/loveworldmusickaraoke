import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import SongCard from "./SongCard";
import { usePlayer, type PlayerSong } from "@/contexts/PlayerContext";
import { useNavigate } from "react-router-dom";

interface SongSectionProps {
  title: string;
}

const SongSection = ({ title }: SongSectionProps) => {
  const [songs, setSongs] = useState<PlayerSong[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.from("songs").select("*").eq("is_featured", true).order("play_count", { ascending: false }).limit(10)
      .then(({ data }) => {
        if (data) {
          setSongs(data.map(s => ({
            id: s.id, title: s.title, artist: s.artist, album: s.album || undefined,
            coverUrl: s.cover_url || undefined, audioUrl: s.audio_url || undefined,
            instrumentalUrl: s.instrumental_url || undefined, lyricsLrc: s.lyrics_lrc || undefined,
            durationSeconds: s.duration_seconds,
          })));
        }
      });
  }, []);

  if (songs.length === 0) return null;

  return (
    <section className="px-4 lg:px-6 mt-8 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-serif font-bold text-foreground">{title}</h3>
        <button onClick={() => navigate("/library")} className="text-xs text-gold hover:text-gold-light font-medium transition-colors duration-200">See All</button>
      </div>
      <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-1 px-1">
        {songs.map((song, i) => (
          <SongCard key={song.id} song={song} index={i} allSongs={songs} />
        ))}
      </div>
    </section>
  );
};

export default SongSection;