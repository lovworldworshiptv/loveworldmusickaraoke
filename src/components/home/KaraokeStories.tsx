import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Play, Pause, X, Timer, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface KaraokeStory {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  song_title: string;
  audio_url: string;
  caption: string | null;
  created_at: string;
}

const KaraokeStories = () => {
  const [stories, setStories] = useState<KaraokeStory[]>([]);
  const [visible, setVisible] = useState(true);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { user } = useAuth();

  const activeStory = activeIndex !== null ? stories[activeIndex] ?? null : null;

  const deleteStory = async (story: KaraokeStory) => {
    audioRef.current?.pause();
    await supabase.from("karaoke_recordings").delete().eq("id", story.id) as any;
    const path = story.audio_url.split("/karaoke-recordings/")[1];
    if (path) await supabase.storage.from("karaoke-recordings").remove([decodeURIComponent(path)]);
    const newStories = stories.filter(x => x.id !== story.id);
    setStories(newStories);
    setActiveIndex(null);
    setPlaying(false);
    toast.success("Story deleted");
  };
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStories = async () => {
      const { data: setting } = await supabase
        .from("app_settings" as any)
        .select("value")
        .eq("key", "karaoke_stories_visible")
        .single();
      if (setting && (setting as any).value === false) {
        setVisible(false);
        return;
      }

      const { data } = await supabase
        .from("karaoke_recordings")
        .select("id, user_id, song_title, audio_url, caption, created_at")
        .gte("created_at", new Date(Date.now() - 24 * 3600000).toISOString())
        .order("created_at", { ascending: false })
        .limit(20) as any;

      if (!data || data.length === 0) return;

      const userIds = [...new Set(data.map((d: any) => d.user_id))] as string[];
      const profiles: Record<string, { username: string; avatar_url: string | null }> = {};

      for (const uid of userIds) {
        const { data: pData } = await supabase.rpc("get_public_profile", { p_user_id: uid });
        if (pData && (pData as any[]).length > 0) {
          const p = (pData as any[])[0];
          profiles[uid] = { username: p.username, avatar_url: p.avatar_url };
        }
      }

      const enriched: KaraokeStory[] = data
        .filter((d: any) => profiles[d.user_id])
        .map((d: any) => ({
          ...d,
          username: profiles[d.user_id].username,
          avatar_url: profiles[d.user_id].avatar_url,
        }));

      setStories(enriched);
    };

    fetchStories();
  }, []);

  const playStoryAt = (index: number) => {
    audioRef.current?.pause();
    const story = stories[index];
    if (!story) return;
    setActiveIndex(index);
    const audio = new Audio(story.audio_url);
    audio.onended = () => {
      if (index + 1 < stories.length) {
        playStoryAt(index + 1);
      } else {
        setPlaying(false);
      }
    };
    audio.play();
    audioRef.current = audio;
    setPlaying(true);
  };

  const openStory = (story: KaraokeStory) => {
    const idx = stories.findIndex(s => s.user_id === story.user_id);
    playStoryAt(idx >= 0 ? idx : 0);
  };

  const goNext = () => {
    if (activeIndex !== null && activeIndex + 1 < stories.length) {
      playStoryAt(activeIndex + 1);
    }
  };

  const goPrev = () => {
    if (activeIndex !== null && activeIndex > 0) {
      playStoryAt(activeIndex - 1);
    }
  };

  const closeStory = () => {
    audioRef.current?.pause();
    setActiveIndex(null);
    setPlaying(false);
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  };

  if (!visible || stories.length === 0) return null;

  const seen = new Set<string>();
  const uniqueStories = stories.filter((s) => {
    if (seen.has(s.user_id)) return false;
    seen.add(s.user_id);
    return true;
  });

  return (
    <>
      <div className="px-4 lg:px-6 pt-4 pb-1">
        {/* Section Header */}
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-xl font-serif font-bold text-foreground">Karaoke Stories</h3>
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary">
            <Timer className="w-3 h-3" />
            <span className="text-[10px] font-semibold">24h</span>
          </div>
        </div>

        <div className="flex gap-3 overflow-x-auto scrollbar-hide py-1">
          {uniqueStories.map((story) => (
            <button
              key={story.id}
              onClick={() => openStory(story)}
              className="flex flex-col items-center gap-1 flex-shrink-0 w-16"
            >
              <div className="w-14 h-14 rounded-full p-[2px] bg-gradient-to-br from-primary to-accent">
                <div className="w-full h-full rounded-full bg-background p-[2px]">
                  {story.avatar_url ? (
                    <img
                      src={story.avatar_url}
                      alt={story.username}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                      {story.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground truncate w-full text-center">
                {story.username}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Story Viewer Modal */}
      {activeStory && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center">
          {/* Previous arrow */}
          {activeIndex !== null && activeIndex > 0 && (
            <button onClick={goPrev} className="absolute left-2 top-1/2 -translate-y-1/2 z-10 text-white/60 hover:text-white p-2">
              <ChevronLeft className="w-8 h-8" />
            </button>
          )}
          {/* Next arrow */}
          {activeIndex !== null && activeIndex + 1 < stories.length && (
            <button onClick={goNext} className="absolute right-2 top-1/2 -translate-y-1/2 z-10 text-white/60 hover:text-white p-2">
              <ChevronRight className="w-8 h-8" />
            </button>
          )}

          <div className="relative w-full max-w-sm mx-4">
            <div className="flex items-center justify-between px-2 pt-2">
              {/* Progress dots */}
              <div className="flex gap-1 flex-1 mr-8">
                {stories.map((_, i) => (
                  <div key={i} className={`h-0.5 flex-1 rounded-full transition-colors ${i === activeIndex ? "bg-primary" : i < (activeIndex ?? 0) ? "bg-white/50" : "bg-white/20"}`} />
                ))}
              </div>
              <button onClick={closeStory} className="text-white/80 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex flex-col items-center gap-6 py-8">
              <button
                onClick={() => { closeStory(); navigate(`/user/${activeStory.user_id}`); }}
                className="text-center"
              >
                <div className="w-20 h-20 mx-auto rounded-full p-[2px] bg-gradient-to-br from-primary to-accent">
                  <div className="w-full h-full rounded-full bg-background p-[2px]">
                    {activeStory.avatar_url ? (
                      <img src={activeStory.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <div className="w-full h-full rounded-full bg-muted flex items-center justify-center text-lg font-bold text-muted-foreground">
                        {activeStory.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-white text-sm font-medium mt-2">{activeStory.username}</p>
              </button>

              <div
                className={`w-40 h-40 rounded-full bg-gradient-to-br from-muted to-card border-4 border-muted flex items-center justify-center ${playing ? "animate-spin" : ""}`}
                style={{ animationDuration: "3s" }}
              >
                <div className="w-16 h-16 rounded-full bg-background flex items-center justify-center">
                  <button onClick={togglePlay}>
                    {playing ? <Pause className="w-8 h-8 text-primary" /> : <Play className="w-8 h-8 text-primary ml-1" />}
                  </button>
                </div>
              </div>

              <div className="text-center">
                <p className="text-white text-sm font-medium">{activeStory.song_title}</p>
                {activeStory.caption && (
                  <p className="text-white/60 text-xs mt-1 italic">"{activeStory.caption}"</p>
                )}
                <p className="text-white/40 text-[10px] mt-1">{(activeIndex ?? 0) + 1} / {stories.length}</p>
              </div>

              {user && user.id === activeStory.user_id && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-destructive/20 text-destructive hover:bg-destructive/30 transition-colors text-xs font-medium">
                      <Trash2 className="w-3.5 h-3.5" /> Delete Story
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this story?</AlertDialogTitle>
                      <AlertDialogDescription>This karaoke story will be permanently deleted.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteStory(activeStory)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default KaraokeStories;
