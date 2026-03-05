import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { User, Music, Clock, AtSign, Play, Pause, Send, Trash2, MessageCircle } from "lucide-react";
import { usePlayer } from "@/contexts/PlayerContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface PublicProfileData {
  user_id: string;
  username: string;
  avatar_url: string | null;
  kingschat_handle: string | null;
}

interface RecentTrack {
  song_id: string;
  played_at: string;
  title: string;
  artist: string;
  cover_url: string | null;
}

interface KaraokeRecording {
  id: string;
  song_id: string;
  song_title: string;
  audio_url: string;
  created_at: string;
  caption: string | null;
}

interface KaraokeComment {
  id: string;
  recording_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  username?: string;
  avatar_url?: string | null;
}

const PublicProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const [profile, setProfile] = useState<PublicProfileData | null>(null);
  const [recentTracks, setRecentTracks] = useState<RecentTrack[]>([]);
  const [karaoke, setKaraoke] = useState<KaraokeRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingKaraoke, setPlayingKaraoke] = useState<string | null>(null);
  const [karaokeAudio, setKaraokeAudio] = useState<HTMLAudioElement | null>(null);
  const { currentSong, isPlaying } = usePlayer();

  // Comments state
  const [comments, setComments] = useState<Record<string, KaraokeComment[]>>({});
  const [showComments, setShowComments] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    Promise.all([
      supabase.rpc("get_public_profile", { p_user_id: userId }),
      supabase.rpc("get_public_recently_played", { p_user_id: userId, p_limit: 5 }),
      supabase.rpc("get_public_karaoke", { p_user_id: userId }),
    ]).then(([profileRes, recentRes, karaokeRes]) => {
      if (profileRes.data && (profileRes.data as any[]).length > 0) {
        setProfile((profileRes.data as any[])[0]);
      }
      setRecentTracks((recentRes.data as RecentTrack[]) || []);
      setKaraoke((karaokeRes.data as unknown as KaraokeRecording[]) || []);
      setLoading(false);
    });
  }, [userId]);

  const playKaraokeClip = (rec: KaraokeRecording) => {
    if (playingKaraoke === rec.id) {
      karaokeAudio?.pause();
      setPlayingKaraoke(null);
      return;
    }
    karaokeAudio?.pause();
    const audio = new Audio(rec.audio_url);
    audio.play();
    audio.onended = () => setPlayingKaraoke(null);
    setKaraokeAudio(audio);
    setPlayingKaraoke(rec.id);
  };

  const timeAgo = (date: string) => {
    const hrs = Math.floor((Date.now() - new Date(date).getTime()) / 3600000);
    if (hrs < 1) return "Just now";
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const timeLeft = (date: string) => {
    const expiresAt = new Date(date).getTime() + 24 * 3600000;
    const left = Math.max(0, expiresAt - Date.now());
    const hrs = Math.floor(left / 3600000);
    const mins = Math.floor((left % 3600000) / 60000);
    return `${hrs}h ${mins}m left`;
  };

  const fetchComments = async (recordingId: string) => {
    setLoadingComments(true);
    const { data } = await supabase
      .from("karaoke_comments" as any)
      .select("*")
      .eq("recording_id", recordingId)
      .order("created_at", { ascending: true }) as any;

    if (data && data.length > 0) {
      // Fetch usernames for commenters
      const userIds = [...new Set(data.map((c: any) => c.user_id))] as string[];
      const profiles: Record<string, { username: string; avatar_url: string | null }> = {};
      for (const uid of userIds) {
        const { data: pData } = await supabase.rpc("get_public_profile", { p_user_id: uid });
        if (pData && (pData as any[]).length > 0) {
          const p = (pData as any[])[0];
          profiles[uid] = { username: p.username, avatar_url: p.avatar_url };
        }
      }
      const enriched = data.map((c: any) => ({
        ...c,
        username: profiles[c.user_id]?.username || "User",
        avatar_url: profiles[c.user_id]?.avatar_url,
      }));
      setComments((prev) => ({ ...prev, [recordingId]: enriched }));
    } else {
      setComments((prev) => ({ ...prev, [recordingId]: [] }));
    }
    setLoadingComments(false);
  };

  const toggleComments = (recordingId: string) => {
    if (showComments === recordingId) {
      setShowComments(null);
    } else {
      setShowComments(recordingId);
      if (!comments[recordingId]) fetchComments(recordingId);
    }
  };

  const submitComment = async (recordingId: string) => {
    if (!user || !commentText.trim()) return;
    const { error } = await supabase.from("karaoke_comments" as any).insert({
      recording_id: recordingId,
      user_id: user.id,
      comment: commentText.trim(),
    } as any);
    if (error) {
      toast.error("Failed to post comment");
      return;
    }
    setCommentText("");
    fetchComments(recordingId);
  };

  const deleteComment = async (commentId: string, recordingId: string) => {
    await supabase.from("karaoke_comments" as any).delete().eq("id", commentId) as any;
    fetchComments(recordingId);
  };

  if (loading) return <AppLayout><div className="p-6 text-center text-muted-foreground">Loading…</div></AppLayout>;
  if (!profile) return <AppLayout><div className="p-6 text-center text-muted-foreground">User not found</div></AppLayout>;

  const isListening = currentSong && isPlaying;

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 lg:pt-6 max-w-md mx-auto pb-24">
        {/* Profile Header */}
        <div className="glass-card p-6 text-center mb-6">
          <div className="w-20 h-20 mx-auto mb-4">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.username} className="w-20 h-20 rounded-full object-cover border-2 border-primary" />
            ) : (
              <div className="w-20 h-20 rounded-full gradient-gold flex items-center justify-center text-primary-foreground text-2xl font-serif font-bold">
                {profile.username.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <h2 className="text-xl font-serif font-bold text-foreground">{profile.username}</h2>
          {profile.kingschat_handle && (
            <p className="flex items-center justify-center gap-1 text-sm text-muted-foreground mt-1">
              <AtSign className="w-3.5 h-3.5" />{profile.kingschat_handle}
            </p>
          )}
        </div>

        {/* Now Playing */}
        {isListening && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Music className="w-4 h-4 text-primary animate-pulse" />
              <h3 className="text-sm font-semibold text-foreground">Now Playing</h3>
            </div>
            <div className="glass-card p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                {currentSong?.coverUrl ? <img src={currentSong.coverUrl} alt="" className="w-full h-full object-cover" /> : <Music className="w-4 h-4 text-muted-foreground" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{currentSong?.title}</p>
                <p className="text-xs text-muted-foreground truncate">{currentSong?.artist}</p>
              </div>
              <span className="text-[10px] text-primary font-medium">♪ Live</span>
            </div>
          </div>
        )}

        {/* Recently Played */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Recently Played</h3>
          </div>
          {recentTracks.length > 0 ? (
            <div className="space-y-2">
              {recentTracks.map((track, i) => (
                <div key={`${track.song_id}-${i}`} className="glass-card p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                    {track.cover_url ? <img src={track.cover_url} alt="" className="w-full h-full object-cover" /> : <Music className="w-4 h-4 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{track.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(track.played_at)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-card p-6 text-center">
              <Music className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No recently played tracks</p>
            </div>
          )}
        </div>

        {/* Karaoke Recordings */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Music className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">My Karaoke</h3>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              <Clock className="w-3 h-3" /> Live for 24h
            </span>
          </div>
          {karaoke.length > 0 ? (
            <div className="space-y-2">
              {karaoke.map((rec) => (
                <div key={rec.id} className="glass-card overflow-hidden">
                  <div className="p-3 flex items-center gap-3">
                    <button onClick={() => playKaraokeClip(rec)} className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      {playingKaraoke === rec.id ? <Pause className="w-4 h-4 text-primary" /> : <Play className="w-4 h-4 text-primary ml-0.5" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{rec.song_title}</p>
                      {rec.caption && <p className="text-[10px] text-muted-foreground italic truncate">"{rec.caption}"</p>}
                      <p className="text-[10px] text-muted-foreground">{timeLeft(rec.created_at)}</p>
                    </div>
                    <button onClick={() => toggleComments(rec.id)} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors relative">
                      <MessageCircle className="w-4 h-4" />
                      {comments[rec.id] && comments[rec.id].length > 0 && (
                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-primary text-[8px] text-primary-foreground flex items-center justify-center">
                          {comments[rec.id].length}
                        </span>
                      )}
                    </button>
                  </div>

                  {/* Comments Section */}
                  {showComments === rec.id && (
                    <div className="border-t border-border px-3 pb-3 pt-2">
                      {loadingComments ? (
                        <p className="text-xs text-muted-foreground text-center py-2">Loading…</p>
                      ) : (
                        <>
                          {(comments[rec.id] || []).length === 0 && (
                            <p className="text-xs text-muted-foreground text-center py-2">No comments yet</p>
                          )}
                          <div className="space-y-2 max-h-40 overflow-y-auto mb-2">
                            {(comments[rec.id] || []).map((c) => (
                              <div key={c.id} className="flex items-start gap-2">
                                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                                  {c.avatar_url ? (
                                    <img src={c.avatar_url} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-[8px] font-bold text-muted-foreground">{(c.username || "U").charAt(0)}</span>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[10px]">
                                    <span className="font-semibold text-foreground">{c.username}</span>{" "}
                                    <span className="text-muted-foreground">{c.comment}</span>
                                  </p>
                                  <p className="text-[8px] text-muted-foreground">{timeAgo(c.created_at)}</p>
                                </div>
                                {user && c.user_id === user.id && (
                                  <button onClick={() => deleteComment(c.id, rec.id)} className="text-muted-foreground hover:text-destructive p-0.5">
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                          {user && (
                            <div className="flex gap-2">
                              <Input
                                value={commentText}
                                onChange={(e) => setCommentText(e.target.value)}
                                placeholder="Add a comment…"
                                className="h-8 text-xs"
                                onKeyDown={(e) => e.key === "Enter" && submitComment(rec.id)}
                              />
                              <Button size="sm" className="h-8 px-2" onClick={() => submitComment(rec.id)} disabled={!commentText.trim()}>
                                <Send className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-card p-6 text-center">
              <Music className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No karaoke recordings</p>
              <p className="text-xs text-muted-foreground mt-1">Karaoke recordings disappear after 24hrs</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default PublicProfile;
