import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayer, type PlayerSong } from "@/contexts/PlayerContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Heart, MessageCircle, Play, Plus, Send, Share2, Sparkles, Trash2, Users, X, Music4, Flame, BookOpen, Sunrise, Globe, Check } from "lucide-react";
import { toast } from "sonner";
import communityHero from "@/assets/community-hero.jpg";

const rateMsg = (e: { message?: string } | null) =>
  e?.message?.includes("rate_limited") ? "You're going a bit fast — please wait a minute and try again." : null;

const COMMUNITY_ICONS = [Heart, Music4, Flame, BookOpen, Sunrise, Sparkles, Users, Globe];

interface CommunityRow { id: string; name: string; description: string | null; cover_url: string | null; member_count?: number }
interface PostRow {
  id: string; community_id: string; user_id: string; content: string; song_id: string | null; created_at: string;
  author_name: string; author_avatar: string | null; like_count: number; liked: boolean; comment_count: number;
  song: { id: string; title: string; artist: string; cover_url: string; audio_url: string; instrumental_url: string | null } | null;
}
interface CommentRow { id: string; content: string; created_at: string; user_id: string; author_name: string; author_avatar: string | null }

const SHARE_BASE = "https://loveworldmusickaraoke.com";

const Community = () => {
  const { user } = useAuth();
  const { playSong } = usePlayer();
  const { isAdmin } = useIsAdmin();
  const [communities, setCommunities] = useState<CommunityRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [content, setContent] = useState("");
  const [attachedSong, setAttachedSong] = useState<PostRow["song"]>(null);
  const [songQuery, setSongQuery] = useState("");
  const [songResults, setSongResults] = useState<PostRow["song"][]>([]);
  const [showSongSearch, setShowSongSearch] = useState(false);
  const [openComments, setOpenComments] = useState<Record<string, CommentRow[]>>({});
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});
  const [posting, setPosting] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const feedRef = useRef<HTMLDivElement>(null);

  const loadCommunities = useCallback(async () => {
    const { data } = await supabase.from("communities").select("*").eq("is_active", true).order("sort_order");
    const rows = (data || []) as CommunityRow[];
    const { data: counts } = await (supabase.rpc as any)("get_community_member_counts");
    const countMap = new Map<string, number>(((counts || []) as { community_id: string; member_count: number }[]).map((r) => [r.community_id, Number(r.member_count)]));
    const withCounts = rows.map((c) => ({ ...c, member_count: countMap.get(c.id) || 0 }));
    setCommunities(withCounts);
    if (!activeId && withCounts.length) setActiveId(withCounts[0].id);
  }, [activeId]);

  useEffect(() => { loadCommunities(); }, []);

  useEffect(() => {
    if (!user || !communities.length) { setMemberIds(new Set()); return; }
    supabase.from("community_members").select("community_id").eq("user_id", user.id)
      .in("community_id", communities.map((c) => c.id))
      .then(({ data }) => setMemberIds(new Set(((data || []) as { community_id: string }[]).map((r) => r.community_id))));
  }, [user, communities]);

  const isMember = activeId ? memberIds.has(activeId) : false;

  const loadPosts = useCallback(async (communityId: string) => {
    let query = supabase
      .from("community_posts")
      .select(`id, community_id, user_id, content, song_id, created_at,
        song:songs(id, title, artist, cover_url, audio_url, instrumental_url),
        likes:community_post_likes(count),
        mylike:community_post_likes(user_id),
        comments:community_post_comments(count)`)
      .eq("community_id", communityId)
      .order("created_at", { ascending: false })
      .limit(50);
    const { data } = await query;
    const rows = (data || []) as any[];
    const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
    const profiles: Record<string, { username: string; avatar_url: string | null }> = {};
    if (userIds.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id, username, avatar_url").in("user_id", userIds);
      (profs || []).forEach((p: any) => { profiles[p.user_id] = { username: p.username, avatar_url: p.avatar_url }; });
    }
    const uid = user?.id;
    const mapped: PostRow[] = rows.map((r) => ({
      id: r.id, community_id: r.community_id, user_id: r.user_id, content: r.content, song_id: r.song_id,
      created_at: r.created_at,
      author_name: profiles[r.user_id]?.username || "User",
      author_avatar: profiles[r.user_id]?.avatar_url || null,
      like_count: r.likes?.[0]?.count || 0,
      liked: uid ? (r.mylike || []).some((l: any) => l.user_id === uid) : false,
      comment_count: r.comments?.[0]?.count || 0,
      song: r.song && r.song.id ? { id: r.song.id, title: r.song.title, artist: r.song.artist, cover_url: r.song.cover_url, audio_url: r.song.audio_url, instrumental_url: r.song.instrumental_url } : null,
    }));
    setPosts(mapped);
  }, [user]);

  useEffect(() => { if (activeId) loadPosts(activeId); }, [activeId, loadPosts]);

  const toggleMembership = async (communityId: string) => {
    if (!user) return;
    if (memberIds.has(communityId)) {
      await supabase.from("community_members").delete().eq("community_id", communityId).eq("user_id", user.id);
      setMemberIds((s) => { const n = new Set(s); n.delete(communityId); return n; });
      toast.success("You left the community");
    } else {
      const { error } = await supabase.from("community_members").insert({ community_id: communityId, user_id: user.id });
      if (error) { toast.error("Could not join right now"); return; }
      setMemberIds((s) => new Set(s).add(communityId));
      toast.success("Welcome to the community!");
    }
    loadCommunities();
    loadPosts(communityId);
  };

  const playAttached = (song: NonNullable<PostRow["song"]>) => {
    const ps: PlayerSong = {
      id: song.id, title: song.title, artist: song.artist || "Loveworld Singers",
      coverUrl: song.cover_url, audioUrl: song.audio_url, instrumentalUrl: song.instrumental_url,
    };
    playSong(ps);
  };

  const searchSongs = async (q: string) => {
    setSongQuery(q);
    if (q.trim().length < 2) { setSongResults([]); return; }
    const { data } = await (supabase.from("songs") as any).select("id, title, artist, cover_url, audio_url, instrumental_url")
      .ilike("title", `%${q}%`).not("audio_url", "is", null).limit(6);
    setSongResults((data || []) as any);
  };

  const createPost = async () => {
    if (!user || !activeId || !content.trim()) return;
    setPosting(true);
    const { error } = await supabase.from("community_posts").insert({
      community_id: activeId, user_id: user.id, content: content.trim(), song_id: attachedSong?.id || null,
    });
    setPosting(false);
    if (error) { toast.error(rateMsg(error) || "Could not share. Are you a member?"); return; }
    setContent(""); setAttachedSong(null); setShowSongSearch(false);
    loadPosts(activeId);
    feedRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    toast.success("Shared with the community");
  };

  const toggleLike = async (post: PostRow) => {
    if (!user) return;
    if (post.liked) {
      await supabase.from("community_post_likes").delete().eq("post_id", post.id).eq("user_id", user.id);
      setPosts((p) => p.map((x) => x.id === post.id ? { ...x, liked: false, like_count: x.like_count - 1 } : x));
    } else {
      const { error } = await supabase.from("community_post_likes").insert({ post_id: post.id, user_id: user.id });
      if (error) { toast.error(rateMsg(error) || "Could not like this post"); return; }
      setPosts((p) => p.map((x) => x.id === post.id ? { ...x, liked: true, like_count: x.like_count + 1 } : x));
    }
  };

  const loadComments = async (postId: string) => {
    const { data } = await supabase.from("community_post_comments").select("*").eq("post_id", postId).order("created_at");
    const rows = (data || []) as any[];
    const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
    const profiles: Record<string, { username: string; avatar_url: string | null }> = {};
    if (userIds.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id, username, avatar_url").in("user_id", userIds);
      (profs || []).forEach((p: any) => { profiles[p.user_id] = { username: p.username, avatar_url: p.avatar_url }; });
    }
    setOpenComments((o) => ({ ...o, [postId]: rows.map((r) => ({ ...r, author_name: profiles[r.user_id]?.username || "User", author_avatar: profiles[r.user_id]?.avatar_url || null })) }));
  };

  const addComment = async (postId: string) => {
    const text = commentDraft[postId]?.trim();
    if (!user || !text) return;
    const { error } = await supabase.from("community_post_comments").insert({ post_id: postId, user_id: user.id, content: text });
    if (!error) {
      setCommentDraft((c) => ({ ...c, [postId]: "" }));
      loadComments(postId);
      setPosts((p) => p.map((x) => x.id === postId ? { ...x, comment_count: x.comment_count + 1 } : x));
    } else {
      toast.error(rateMsg(error) || "Could not post your comment");
    }
  };

  const deletePost = async (postId: string) => {
    await supabase.from("community_posts").delete().eq("id", postId);
    setPosts((p) => p.filter((x) => x.id !== postId));
  };

  const sharePost = async (post: PostRow) => {
    const url = `${SHARE_BASE}/community`;
    const text = `${post.author_name} on Loveworld Music Karaoke+ Community: "${post.content.slice(0, 80)}"`;
    try {
      if (navigator.share) { await navigator.share({ title: "Loveworld Music Karaoke+", text, url }); return; }
      await navigator.clipboard.writeText(`${text} ${url}`);
      toast.success("Link copied");
    } catch { /* dismissed */ }
  };

  const createCommunity = async () => {
    if (!newName.trim()) return;
    const { error } = await supabase.from("communities").insert({ name: newName.trim(), description: newDesc.trim() || null, created_by: user?.id || null });
    if (!error) { setManageOpen(false); setNewName(""); setNewDesc(""); loadCommunities(); toast.success("Community created"); }
    else toast.error("That name may already exist");
  };

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const activeCommunity = communities.find((c) => c.id === activeId);
  const totalMembers = communities.reduce((sum, c) => sum + (c.member_count || 0), 0);
  const goldBtn = "rounded-full bg-gradient-to-r from-[#c9a227] to-[#8b6914] text-white font-semibold";

  return (
    <AppLayout>
      <div className="px-4 md:px-8 pt-6 pb-28 lg:pb-10 max-w-4xl mx-auto">
        {/* Hero */}
        <div className="relative rounded-3xl overflow-hidden shadow-[0_18px_50px_-20px_rgba(201,162,39,0.45)]">
          <img src={communityHero} alt="" className="w-full h-48 md:h-72 object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/55 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/70 via-transparent to-transparent" />
          {isAdmin && (
            <button onClick={() => setManageOpen(true)}
              className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full glass-card border border-gold/30 px-3 py-1.5 text-xs font-semibold text-white hover:border-gold/60 transition-colors">
              <Plus className="w-3.5 h-3.5" /> New Community
            </button>
          )}
          <div className="absolute bottom-0 left-0 right-0 p-5 md:p-7">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gold/15 border border-gold/30 px-3 py-1 text-[11px] font-medium text-gold">
              <Sparkles className="w-3 h-3" /> Worship Together
            </span>
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-white mt-2">Community</h1>
            <p className="text-sm text-white/80 mt-1 max-w-md">Share testimonies, prayer points and worship moments with believers everywhere.</p>
            <div className="flex items-center gap-4 mt-3 text-[11px] md:text-xs text-white/75">
              <span className="inline-flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-gold" /> {totalMembers.toLocaleString()} members</span>
              <span className="inline-flex items-center gap-1.5"><Globe className="w-3.5 h-3.5 text-gold" /> {communities.length} communities</span>
            </div>
          </div>
        </div>

        {/* Communities grid */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {communities.map((c, i) => {
            const Icon = COMMUNITY_ICONS[i % COMMUNITY_ICONS.length];
            const active = c.id === activeId;
            const joined = memberIds.has(c.id);
            return (
              <div key={c.id} onClick={() => setActiveId(c.id)}
                className={`glass-card rounded-2xl p-4 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:border-gold/40 hover:shadow-[0_10px_30px_-12px_rgba(201,162,39,0.5)] ${active ? "border-gold/70 ring-1 ring-gold/40" : ""}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-11 h-11 rounded-xl shrink-0 flex items-center justify-center transition-colors ${active ? "bg-gradient-to-br from-[#c9a227] to-[#8b6914]" : "bg-gold/15 border border-gold/25"}`}>
                    <Icon className={`w-5 h-5 ${active ? "text-white" : "text-gold"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                    {c.description ? (
                      <p className="text-xs text-foreground/65 mt-0.5 line-clamp-2">{c.description}</p>
                    ) : (
                      <p className="text-xs text-foreground/45 mt-0.5 italic">A space to gather and share</p>
                    )}
                  </div>
                  {joined && <Check className="w-4 h-4 text-gold shrink-0 mt-1" />}
                </div>
                <div className="flex items-center justify-between mt-3">
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-foreground/60">
                    <Users className="w-3.5 h-3.5 text-gold/70" /> {(c.member_count || 0).toLocaleString()}
                  </span>
                  {user && (
                    <Button size="sm" variant={joined ? "secondary" : "default"} onClick={(e) => { e.stopPropagation(); toggleMembership(c.id); }}
                      className={`${joined ? "rounded-full text-foreground" : goldBtn} h-7 px-3 text-xs`}>
                      {joined ? "Joined" : "Join"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {isMember && (
          <div className="glass-card rounded-2xl p-4 mt-4">
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3}
              placeholder="Share a testimony, prayer point or word of worship..."
              className="w-full bg-transparent resize-none text-sm text-foreground placeholder:text-foreground/40 outline-none" />
            {attachedSong && (
              <div className="flex items-center gap-2 mt-2 bg-secondary/60 rounded-xl px-3 py-2">
                {attachedSong.cover_url && <img src={attachedSong.cover_url} alt="" className="w-9 h-9 rounded-lg object-cover" />}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{attachedSong.title}</p>
                  <p className="text-[10px] text-foreground/60 truncate">{attachedSong.artist}</p>
                </div>
                <button onClick={() => setAttachedSong(null)} className="p-1 rounded-full hover:bg-muted"><X className="w-3.5 h-3.5" /></button>
              </div>
            )}
            {showSongSearch && (
              <div className="mt-2">
                <Input value={songQuery} onChange={(e) => searchSongs(e.target.value)} placeholder="Search a song to attach..." className="bg-secondary/50 border-border text-foreground" />
                {songResults.map((s) => (
                  <button key={s.id} onClick={() => { setAttachedSong(s); setShowSongSearch(false); setSongQuery(""); setSongResults([]); }}
                    className="w-full flex items-center gap-2 px-2 py-2 rounded-xl hover:bg-secondary/60 text-left">
                    {s.cover_url && <img src={s.cover_url} alt="" className="w-8 h-8 rounded-lg object-cover" />}
                    <span className="text-xs text-foreground truncate">{s.title}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between mt-3">
              <Button variant="ghost" size="sm" onClick={() => setShowSongSearch((v) => !v)} className="text-foreground/80 hover:text-gold rounded-full">
                <Play className="w-4 h-4 mr-1" /> Attach song
              </Button>
              <Button size="sm" disabled={!content.trim() || posting} onClick={createPost} className={goldBtn}>
                <Send className="w-4 h-4 mr-1" /> Share
              </Button>
            </div>
          </div>
        )}

        <div ref={feedRef} className="mt-6 space-y-4">
          {!user && (
            <div className="text-center py-10">
              <p className="text-foreground/70 text-sm">Sign in to join the conversation.</p>
              <Link to="/auth"><Button size="sm" className={`mt-3 ${goldBtn}`}>Sign in</Button></Link>
            </div>
          )}
          {user && !isMember && posts.length === 0 && (
            <p className="text-center text-sm text-foreground/50 py-10">Join this community to see and share posts.</p>
          )}
          {posts.map((post) => (
            <div key={post.id} className="glass-card rounded-2xl p-4">
              <div className="flex items-center gap-3">
                {post.author_avatar ? (
                  <img src={post.author_avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gold/20 flex items-center justify-center text-gold font-bold text-sm">{post.author_name.charAt(0).toUpperCase()}</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{post.author_name}</p>
                  <p className="text-[11px] text-foreground/60">{timeAgo(post.created_at)}</p>
                </div>
                <button onClick={() => sharePost(post)} className="p-2 rounded-full hover:bg-muted text-foreground/70 hover:text-gold" title="Share"><Share2 className="w-4 h-4" /></button>
                {(isAdmin || post.user_id === user?.id) && (
                  <button onClick={() => deletePost(post.id)} className="p-2 rounded-full hover:bg-destructive/10 text-foreground/60 hover:text-destructive" title="Delete"><Trash2 className="w-4 h-4" /></button>
                )}
              </div>
              <p className="text-sm text-foreground mt-3 whitespace-pre-wrap break-words">{post.content}</p>
              {post.song && (
                <button onClick={() => playAttached(post.song!)} className="mt-3 w-full flex items-center gap-3 bg-secondary/50 hover:bg-secondary/80 rounded-xl p-2 text-left transition-colors">
                  {post.song.cover_url && <img src={post.song.cover_url} alt="" className="w-11 h-11 rounded-lg object-cover" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{post.song.title}</p>
                    <p className="text-[11px] text-foreground/60 truncate">{post.song.artist}</p>
                  </div>
                  <span className="w-9 h-9 rounded-full bg-gradient-to-r from-[#c9a227] to-[#8b6914] flex items-center justify-center shrink-0">
                    <Play className="w-4 h-4 text-white ml-0.5" fill="currentColor" />
                  </span>
                </button>
              )}
              <div className="flex items-center gap-5 mt-3">
                <button onClick={() => toggleLike(post)} className={`flex items-center gap-1.5 text-xs transition-colors ${post.liked ? "text-gold" : "text-foreground/60 hover:text-foreground"}`}>
                  <Heart className={`w-4 h-4 ${post.liked ? "fill-current" : ""}`} /> {post.like_count}
                </button>
                <button onClick={() => { if (!openComments[post.id]) loadComments(post.id); else setOpenComments((o) => { const n = { ...o }; delete n[post.id]; return n; }); }}
                  className="flex items-center gap-1.5 text-xs text-foreground/60 hover:text-foreground">
                  <MessageCircle className="w-4 h-4" /> {post.comment_count}
                </button>
              </div>
              {openComments[post.id] && (
                <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
                  {openComments[post.id].map((c) => (
                    <div key={c.id} className="flex items-start gap-2">
                      <div className="w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center text-gold text-[10px] font-bold shrink-0">{c.author_name.charAt(0).toUpperCase()}</div>
                      <div className="bg-secondary/40 rounded-xl px-3 py-2 min-w-0">
                        <p className="text-[11px] font-semibold text-foreground">{c.author_name}</p>
                        <p className="text-xs text-foreground/90 break-words">{c.content}</p>
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input value={commentDraft[post.id] || ""} onChange={(e) => setCommentDraft((c) => ({ ...c, [post.id]: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && addComment(post.id)} placeholder="Write a comment..."
                      className="bg-secondary/50 border-border text-foreground text-xs" />
                    <Button size="sm" onClick={() => addComment(post.id)} disabled={!commentDraft[post.id]?.trim()}
                      className={`${goldBtn} px-3`}><Send className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="glass-card border-gold/20 rounded-2xl">
          <DialogHeader><DialogTitle className="font-serif text-foreground">New Community</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Community name" className="bg-secondary/50 border-border text-foreground" />
            <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Short description" className="bg-secondary/50 border-border text-foreground" />
            <Button onClick={createCommunity} className={`w-full ${goldBtn}`}>Create</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Community;
