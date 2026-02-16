import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Search, Play, Heart } from "lucide-react";
import { topSongs, featuredSongs } from "@/data/mockData";
import { usePlayer, type PlayerSong } from "@/contexts/PlayerContext";

const allSongs = [...topSongs, ...featuredSongs];

const Library = () => {
  const [search, setSearch] = useState("");
  const { playSong, currentSong, isPlaying } = usePlayer();

  const filtered = allSongs.filter(
    (s) =>
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.artist.toLowerCase().includes(search.toLowerCase())
  );

  const handlePlay = (song: typeof allSongs[0]) => {
    const ps: PlayerSong = {
      id: song.id, title: song.title, artist: song.artist,
      coverUrl: song.coverUrl, durationSeconds: 240,
      lyricsLrc: `[00:00.00]${song.title}\n[00:05.00]By ${song.artist}\n[00:10.00]Verse 1\n[00:15.00]Singing to the Lord\n[00:20.00]With all my heart\n[00:25.00]You are worthy\n[00:30.00]Of all the praise\n[00:35.00]Chorus\n[00:40.00]Hallelujah\n[00:45.00]Glory to God\n[00:50.00]Forever and ever\n[00:55.00]Amen`,
    };
    playSong(ps);
  };

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 lg:pt-6">
        <h2 className="text-2xl font-serif font-bold text-foreground mb-4">My Library</h2>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text" placeholder="Search songs, artists..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <Tabs defaultValue="all">
          <TabsList className="w-full bg-muted/50 mb-4">
            <TabsTrigger value="all" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">All Songs</TabsTrigger>
            <TabsTrigger value="favorites" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Favorites</TabsTrigger>
            <TabsTrigger value="playlists" className="flex-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Playlists</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <div className="space-y-2">
              {filtered.map((song, i) => (
                <button key={song.id} onClick={() => handlePlay(song)}
                  className={`flex items-center gap-3 w-full p-3 rounded-xl transition-all duration-200 hover:bg-muted/60 ${
                    currentSong?.id === song.id ? "bg-muted/80 ring-1 ring-primary" : ""
                  }`}>
                  <div className="w-12 h-12 rounded-lg gradient-purple flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-gold opacity-60">{i + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium text-foreground truncate">{song.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{song.artist} • {song.duration}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Heart className="w-4 h-4 text-muted-foreground" />
                    {currentSong?.id === song.id && isPlaying ? (
                      <div className="flex gap-0.5 items-end h-4">
                        <div className="w-0.5 h-2 bg-gold rounded-full animate-pulse" />
                        <div className="w-0.5 h-3 bg-gold rounded-full animate-pulse" style={{ animationDelay: "0.15s" }} />
                        <div className="w-0.5 h-4 bg-gold rounded-full animate-pulse" style={{ animationDelay: "0.3s" }} />
                      </div>
                    ) : (
                      <Play className="w-4 h-4 text-gold" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="favorites">
            <div className="text-center py-12 text-muted-foreground">
              <Heart className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Sign in to see your favorites</p>
            </div>
          </TabsContent>

          <TabsContent value="playlists">
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">Sign in to create playlists</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
      <div className="h-8" />
    </AppLayout>
  );
};

export default Library;
