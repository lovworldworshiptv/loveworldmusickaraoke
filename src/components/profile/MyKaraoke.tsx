import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Music, Clock, Play, Pause, Trash2, Share2, Copy, ExternalLink, MessageCircle, ChevronDown, ChevronUp, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useFeatures } from "@/contexts/FeatureContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface Recording {
  id: string;
  song_id: string;
  song_title: string;
  audio_url: string;
  created_at: string;
}

interface Comment {
  id: string;
  comment: string;
  created_at: string;
  user_id: string;
  username?: string;
  avatar_url?: string;
}

const MyKaraoke = () => {
  const { user } = useAuth();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const { enabled } = useFeatures();
  const featureEnabled = enabled("myKaraoke");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [shareRec, setShareRec] = useState<Recording | null>(null);
  const [expandedComments, setExpandedComments] = useState<string | null>(null);
  const [expandedViewers, setExpandedViewers] = useState<string | null>(null);
  const [viewers, setViewers] = useState<Record<string, { username: string; avatar_url: string | null }[]>>({});
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!featureEnabled) { audioRef.current?.pause(); setPlayingId(null); }
  }, [featureEnabled]);

  const fetchRecordings = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("karaoke_recordings")
      .select("*")
      .eq("user_id", user.id)
      .gte("created_at", new Date(Date.now() - 24 * 3600000).toISOString())
      .order("created_at", { ascending: false }) as any;
    const recs: Recording[] = data || [];
    setRecordings(recs);
    setLoading(false);

    // Fetch comment counts and view counts for all recordings
    if (recs.length > 0) {
      const ids = recs.map(r => r.id);
      const [commentsRes, viewsRes] = await Promise.all([
        supabase.from("karaoke_comments").select("recording_id").in("recording_id", ids) as any,
        supabase.from("karaoke_story_views").select("recording_id").in("recording_id", ids) as any,
      ]);
      const counts: Record<string, number> = {};
      (commentsRes.data || []).forEach((c: any) => {
        counts[c.recording_id] = (counts[c.recording_id] || 0) + 1;
      });
      setCommentCounts(counts);
      const vCounts: Record<string, number> = {};
      (viewsRes.data || []).forEach((v: any) => {
        vCounts[v.recording_id] = (vCounts[v.recording_id] || 0) + 1;
      });
      setViewCounts(vCounts);
    }
  };

  useEffect(() => { fetchRecordings(); }, [user]);

  const fetchComments = async (recordingId: string) => {
    const { data } = await supabase
      .from("karaoke_comments")
      .select("*")
      .eq("recording_id", recordingId)
      .order("created_at", { ascending: true }) as any;
    
    const rawComments: any[] = data || [];
    // Fetch usernames for commenters using public profile RPC (bypasses RLS)
    const userIds = [...new Set(rawComments.map(c => c.user_id))];
    let profileMap: Record<string, { username: string; avatar_url: string | null }> = {};
    if (userIds.length > 0) {
      const profileResults = await Promise.all(
        userIds.map(uid => supabase.rpc("get_public_profile", { p_user_id: uid }))
      );
      profileResults.forEach(({ data: profiles }) => {
        const p = (profiles as any)?.[0];
        if (p) profileMap[p.user_id] = { username: p.username, avatar_url: p.avatar_url };
      });
    }

    const enriched: Comment[] = rawComments.map(c => ({
      ...c,
      username: profileMap[c.user_id]?.username || "User",
      avatar_url: profileMap[c.user_id]?.avatar_url || null,
    }));
    setComments(prev => ({ ...prev, [recordingId]: enriched }));
  };

  const toggleComments = (recordingId: string) => {
    if (expandedComments === recordingId) {
      setExpandedComments(null);
    } else {
      setExpandedComments(recordingId);
      if (!comments[recordingId]) {
        fetchComments(recordingId);
      }
    }
  };

  const fetchViewers = async (recordingId: string) => {
    const { data } = await supabase
      .from("karaoke_story_views")
      .select("viewer_id")
      .eq("recording_id", recordingId)
      .order("viewed_at", { ascending: false }) as any;
    const viewerIds = [...new Set((data || []).map((v: any) => v.viewer_id))] as string[];
    if (viewerIds.length === 0) { setViewers(prev => ({ ...prev, [recordingId]: [] })); return; }
    const profileResults = await Promise.all(
      viewerIds.map(uid => supabase.rpc("get_public_profile", { p_user_id: uid }))
    );
    const viewerProfiles = viewerIds.map((uid, i) => {
      const p = (profileResults[i]?.data as any)?.[0];
      return { username: p?.username || "User", avatar_url: p?.avatar_url || null };
    });
    setViewers(prev => ({ ...prev, [recordingId]: viewerProfiles }));
  };

  const toggleViewers = (recordingId: string) => {
    if (expandedViewers === recordingId) {
      setExpandedViewers(null);
    } else {
      setExpandedViewers(recordingId);
      if (!viewers[recordingId]) fetchViewers(recordingId);
    }
  };

  const playRecording = (rec: Recording) => {
    if (playingId === rec.id) { audioRef.current?.pause(); setPlayingId(null); return; }
    audioRef.current?.pause();
    const audio = new Audio(rec.audio_url);
    audio.onended = () => setPlayingId(null);
    audio.play();
    audioRef.current = audio;
    setPlayingId(rec.id);
  };

  const deleteRecording = async (rec: Recording) => {
    await supabase.from("karaoke_recordings").delete().eq("id", rec.id) as any;
    const path = rec.audio_url.split("/karaoke-recordings/")[1];
    if (path) await supabase.storage.from("karaoke-recordings").remove([decodeURIComponent(path)]);
    setRecordings(r => r.filter(x => x.id !== rec.id));
    toast.success("Recording deleted");
  };

  const openShare = (rec: Recording) => {
    setShareRec(rec);
    setShowShare(true);
  };

  const timeLeft = (date: string) => {
    const expiresAt = new Date(date).getTime() + 24 * 3600000;
    const left = Math.max(0, expiresAt - Date.now());
    const hrs = Math.floor(left / 3600000);
    const mins = Math.floor((left % 3600000) / 60000);
    return `${hrs}h ${mins}m left`;
  };

  const formatCommentTime = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return d.toLocaleDateString();
  };

  const shareText = shareRec ? `Listen to my karaoke version of ${shareRec.song_title} on Loveworld Music Karaoke.` : "";
  const shareUrl = user ? `${window.location.origin}/user/${user.id}` : "";

  if (!featureEnabled) return null;
  if (loading) return null;
  if (recordings.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Music className="w-4 h-4 text-gold" />
        <h3 className="text-sm font-semibold text-foreground">My Karaoke</h3>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          <Clock className="w-3 h-3" /> Live for 24h
        </span>
      </div>
      <div className="space-y-2">
        {recordings.map(rec => (
          <div key={rec.id}>
            <div className="glass-card p-3 flex items-center gap-3">
              <button onClick={() => playRecording(rec)} className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center flex-shrink-0">
                {playingId === rec.id ? <Pause className="w-4 h-4 text-gold" /> : <Play className="w-4 h-4 text-gold ml-0.5" />}
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{rec.song_title}</p>
                <p className="text-[10px] text-muted-foreground">{timeLeft(rec.created_at)}</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => toggleViewers(rec.id)}
                  className={`p-1.5 transition-colors flex items-center gap-0.5 ${expandedViewers === rec.id ? 'text-gold' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <Eye className="w-4 h-4" />
                  {(viewCounts[rec.id] || 0) > 0 && (
                    <span className="text-[10px] font-medium">{viewCounts[rec.id]}</span>
                  )}
                </button>
                <button
                  onClick={() => toggleComments(rec.id)}
                  className={`p-1.5 transition-colors flex items-center gap-0.5 ${expandedComments === rec.id ? 'text-gold' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <MessageCircle className="w-4 h-4" />
                  {(commentCounts[rec.id] || 0) > 0 && (
                    <span className="text-[10px] font-medium">{commentCounts[rec.id]}</span>
                  )}
                </button>
                <button onClick={() => openShare(rec)} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
                  <Share2 className="w-4 h-4" />
                </button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button className="p-1.5 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete recording?</AlertDialogTitle>
                      <AlertDialogDescription>This karaoke recording will be permanently deleted.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteRecording(rec)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>

            {/* Comments section */}
            {expandedComments === rec.id && (
              <div className="ml-4 mt-1 mb-2 border-l-2 border-border/50 pl-3">
                {!comments[rec.id] ? (
                  <p className="text-xs text-muted-foreground py-2">Loading comments…</p>
                ) : comments[rec.id].length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">No comments yet</p>
                ) : (
                  <div className="space-y-2 py-2">
                    {comments[rec.id].map(c => (
                      <div key={c.id} className="flex items-start gap-2">
                        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {c.avatar_url ? (
                            <img src={c.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[10px] font-bold text-muted-foreground">
                              {(c.username || "U")[0].toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-xs font-semibold text-foreground">{c.username}</span>
                            <span className="text-[10px] text-muted-foreground">{formatCommentTime(c.created_at)}</span>
                          </div>
                          <p className="text-xs text-foreground/80 break-words">{c.comment}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Viewers section */}
            {expandedViewers === rec.id && (
              <div className="ml-4 mt-1 mb-2 border-l-2 border-gold/30 pl-3">
                {!viewers[rec.id] ? (
                  <p className="text-xs text-muted-foreground py-2">Loading viewers…</p>
                ) : viewers[rec.id].length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">No views yet</p>
                ) : (
                  <div className="space-y-1.5 py-2">
                    <p className="text-[10px] text-muted-foreground font-medium mb-1">Viewed by {viewers[rec.id].length} {viewers[rec.id].length === 1 ? "person" : "people"}</p>
                    {viewers[rec.id].map((v, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {v.avatar_url ? (
                            <img src={v.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[8px] font-bold text-muted-foreground">{v.username[0]?.toUpperCase()}</span>
                          )}
                        </div>
                        <span className="text-xs text-foreground">{v.username}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <Dialog open={showShare} onOpenChange={setShowShare}>
        <DialogContent className="max-w-sm">
          <h3 className="text-lg font-serif font-bold text-foreground mb-4">Share Recording</h3>
          <p className="text-xs text-muted-foreground mb-4">{shareText}</p>
          <div className="space-y-2">
            <Button onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success("Link copied!"); }} variant="outline" className="w-full justify-start">
              <Copy className="w-4 h-4 mr-2" /> Copy Link
            </Button>
            <a href={`https://kingschat.online/share?text=${encodeURIComponent(shareText + " " + shareUrl)}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 w-full px-4 py-2 rounded-md border border-border text-sm hover:bg-muted transition-colors">
              <ExternalLink className="w-4 h-4" /> Share on KingsChat
            </a>
            <a href={`https://lettubbe.com/?share=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 w-full px-4 py-2 rounded-md border border-border text-sm hover:bg-muted transition-colors">
              <ExternalLink className="w-4 h-4" /> Share on Lettubbe
            </a>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyKaraoke;
