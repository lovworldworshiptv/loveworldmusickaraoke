import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ThumbsUp, MessageSquareText, MoreVertical, X, Loader2, Info, ChevronRight, SendHorizontal } from "lucide-react";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { usePlayer } from "@/contexts/PlayerContext";
import { linkifyComment, relativeTime } from "@/lib/videoComments";
import { toast } from "sonner";

export type VComment = {
  id: string; song_video_id: string; user_id: string; parent_id: string | null; body: string;
  like_count: number; reply_count: number; is_deleted: boolean; created_at: string;
};
type Author = { username: string; avatar_url: string | null };
const PAGE = 20;
const COLS = "id,song_video_id,user_id,parent_id,body,like_count,reply_count,is_deleted,created_at";

const authorCache = new Map<string, Author>();
async function loadAuthors(ids: string[]) {
  const missing = [...new Set(ids)].filter((id) => !authorCache.has(id));
  await Promise.all(missing.map(async (id) => {
    const { data } = await supabase.rpc("get_public_profile", { p_user_id: id });
    const p = (data as { username: string; avatar_url: string | null }[] | null)?.[0];
    authorCache.set(id, { username: p?.username || "Listener", avatar_url: p?.avatar_url || null });
  }));
}

/** Comments row under a video plus the sheet that holds the conversation. */
const VideoComments = ({ videoId }: { videoId: string }) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [preview, setPreview] = useState<VComment | null>(null);

  const refreshSummary = useCallback(async () => {
    const { data: c } = await supabase.rpc("get_video_comment_count", { p_video_id: videoId });
    setCount(typeof c === "number" ? c : 0);
    if (!user) { setPreview(null); return; }
    const { data } = await supabase.from("video_comments").select(COLS).eq("song_video_id", videoId).is("parent_id", null).eq("is_deleted", false).order("created_at", { ascending: false }).limit(1);
    const top = (data?.[0] as VComment | undefined) ?? null;
    if (top) await loadAuthors([top.user_id]);
    setPreview(top);
  }, [user, videoId]);

  useEffect(() => { setCount(null); setPreview(null); refreshSummary(); }, [refreshSummary]);

  // Keep the count right while the video is on screen: new, removed and replies from anyone.
  useEffect(() => {
    if (!user) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const ch = supabase.channel(`vc-count-${videoId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "video_comments", filter: `song_video_id=eq.${videoId}` }, () => {
        clearTimeout(t); t = setTimeout(refreshSummary, 400);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "video_comments" }, () => {
        clearTimeout(t); t = setTimeout(refreshSummary, 400);
      })
      .subscribe();
    return () => { clearTimeout(t); supabase.removeChannel(ch); };
  }, [user, videoId, refreshSummary]);

  return (
    <>
      <div className="px-4 mt-2 mb-1 flex gap-2 overflow-x-auto flex-shrink-0">
        <button onClick={() => setOpen(true)}
          className="h-10 shrink-0 rounded-full bg-muted/70 hover:bg-muted px-4 inline-flex items-center gap-2 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          aria-label={`Open comments${count != null ? `, ${count} ${count === 1 ? "comment" : "comments"}` : ""}`}>
          <MessageSquareText className="w-5 h-5" aria-hidden />
          <span className="tabular-nums">{count != null ? count.toLocaleString() : "Comments"}</span>
        </button>
        {preview && (
          <button onClick={() => setOpen(true)} className="h-10 min-w-0 flex-1 rounded-full bg-muted/40 px-4 text-left text-xs text-muted-foreground truncate" aria-hidden tabIndex={-1}>
            <span className="font-semibold text-foreground">@{authorCache.get(preview.user_id)?.username}</span> {preview.body}
          </button>
        )}
      </div>
      <Drawer open={open} onOpenChange={(o) => { setOpen(o); if (!o) refreshSummary(); }}>
        <DrawerContent className="h-[85dvh] max-h-[85dvh] bg-card border-border">
          <CommentsPanel videoId={videoId} onClose={() => setOpen(false)} />
        </DrawerContent>
      </Drawer>
    </>
  );
};

const CommentsPanel = ({ videoId, onClose }: { videoId: string; onClose: () => void }) => {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  const { isExpanded, toggleExpanded } = usePlayer();
  const [sort, setSort] = useState<"top" | "new">("top");
  const [items, setItems] = useState<VComment[]>([]);
  const [replies, setReplies] = useState<Record<string, VComment[]>>({});
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(0);
  const [, force] = useState(0);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<VComment | null>(null);
  const [posting, setPosting] = useState(false);
  const [showNote, setShowNote] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const itemsRef = useRef(items); itemsRef.current = items;

  const loadLikes = async (ids: string[]) => {
    if (!user || !ids.length) return;
    const { data } = await supabase.from("video_comment_likes").select("comment_id").eq("user_id", user.id).in("comment_id", ids);
    setLiked((s) => { const n = new Set(s); (data || []).forEach((r) => n.add(r.comment_id)); return n; });
  };

  const loadPage = useCallback(async (reset = false) => {
    if (!user) return;
    setLoading(true);
    const offset = reset ? 0 : itemsRef.current.length;
    let q = supabase.from("video_comments").select(COLS).eq("song_video_id", videoId).is("parent_id", null);
    q = sort === "top" ? q.order("like_count", { ascending: false }).order("created_at", { ascending: false }) : q.order("created_at", { ascending: false });
    const { data } = await q.order("id").range(offset, offset + PAGE - 1);
    const rows = ((data || []) as VComment[]).filter((c) => !c.is_deleted || c.reply_count > 0);
    await loadAuthors(rows.map((r) => r.user_id));
    await loadLikes(rows.map((r) => r.id));
    setItems((prev) => (reset ? rows : [...prev, ...rows.filter((r) => !prev.some((p) => p.id === r.id))]));
    setDone((data || []).length < PAGE);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, sort, user]);

  useEffect(() => { setPending(0); loadPage(true); }, [loadPage]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting && !loading && !done) loadPage(); }, { root: listRef.current });
    io.observe(el);
    return () => io.disconnect();
  }, [loadPage, loading, done]);

  // Live updates from other listeners.
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`vc-${videoId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "video_comments", filter: `song_video_id=eq.${videoId}` }, async (payload) => {
        const row = (payload.new && Object.keys(payload.new).length ? payload.new : payload.old) as VComment;
        if (payload.eventType === "INSERT") {
          if (row.user_id === user.id) return;
          await loadAuthors([row.user_id]);
          if (row.parent_id) setReplies((r) => (r[row.parent_id!] ? { ...r, [row.parent_id!]: [...r[row.parent_id!], row] } : r));
          else setPending((n) => n + 1);
        } else if (payload.eventType === "UPDATE") {
          setItems((l) => l.map((c) => (c.id === row.id ? row : c)).filter((c) => !c.is_deleted || c.reply_count > 0));
          setReplies((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.map((c) => (c.id === row.id ? row : c)).filter((c) => !c.is_deleted)])));
        } else if (payload.eventType === "DELETE") {
          setItems((l) => l.filter((c) => c.id !== row.id));
          setReplies((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.filter((c) => c.id !== row.id)])));
        }
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [videoId, user]);

  const showNew = () => { setPending(0); listRef.current?.scrollTo({ top: 0 }); loadPage(true); };

  const openReplies = async (c: VComment) => {
    if (replies[c.id]) { setReplies((r) => { const n = { ...r }; delete n[c.id]; return n; }); return; }
    const { data } = await supabase.from("video_comments").select(COLS).eq("parent_id", c.id).eq("is_deleted", false).order("created_at").limit(200);
    const rows = (data || []) as VComment[];
    await loadAuthors(rows.map((r) => r.user_id));
    await loadLikes(rows.map((r) => r.id));
    setReplies((r) => ({ ...r, [c.id]: rows }));
  };

  const patch = (id: string, f: (c: VComment) => VComment) => {
    setItems((l) => l.map((c) => (c.id === id ? f(c) : c)));
    setReplies((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.map((c) => (c.id === id ? f(c) : c))])));
  };

  const toggleLike = async (c: VComment) => {
    if (!user) return;
    const was = liked.has(c.id);
    setLiked((s) => { const n = new Set(s); was ? n.delete(c.id) : n.add(c.id); return n; });
    patch(c.id, (x) => ({ ...x, like_count: Math.max(0, x.like_count + (was ? -1 : 1)) }));
    const { error } = was
      ? await supabase.from("video_comment_likes").delete().eq("comment_id", c.id).eq("user_id", user.id)
      : await supabase.from("video_comment_likes").insert({ comment_id: c.id, user_id: user.id });
    if (error) {
      setLiked((s) => { const n = new Set(s); was ? n.add(c.id) : n.delete(c.id); return n; });
      patch(c.id, (x) => ({ ...x, like_count: Math.max(0, x.like_count + (was ? 1 : -1)) }));
      toast.error("Couldn't update like.");
    }
  };

  const remove = async (c: VComment) => {
    const hasReplies = !c.parent_id && c.reply_count > 0;
    const { error } = hasReplies
      ? await supabase.from("video_comments").update({ is_deleted: true }).eq("id", c.id)
      : await supabase.from("video_comments").delete().eq("id", c.id);
    if (error) { toast.error("Couldn't delete comment."); return; }
    if (hasReplies) patch(c.id, (x) => ({ ...x, is_deleted: true }));
    else {
      setItems((l) => l.filter((x) => x.id !== c.id).map((x) => (x.id === c.parent_id ? { ...x, reply_count: Math.max(0, x.reply_count - 1) } : x)));
      setReplies((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.filter((x) => x.id !== c.id)])));
    }
    toast.success("Comment deleted");
  };

  const startReply = (c: VComment) => {
    const parent = c.parent_id ? itemsRef.current.find((x) => x.id === c.parent_id) ?? c : c;
    setReplyTo(parent);
    setText(`@${authorCache.get(c.user_id)?.username || "Listener"} `);
    setTimeout(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }, 0);
  };

  const post = async () => {
    if (!user || !text.trim() || posting) return;
    setPosting(true);
    const { data, error } = await supabase.from("video_comments")
      .insert({ song_video_id: videoId, user_id: user.id, body: text.trim(), parent_id: replyTo?.id ?? null }).select(COLS).single();
    setPosting(false);
    if (error || !data) { toast.error(error?.message?.includes("too fast") ? "You're commenting too fast. Please wait a minute." : "Couldn't post comment."); return; }
    await loadAuthors([user.id]);
    const row = data as VComment;
    if (row.parent_id) {
      setItems((l) => l.map((x) => (x.id === row.parent_id ? { ...x, reply_count: x.reply_count + 1 } : x)));
      setReplies((r) => ({ ...r, [row.parent_id!]: [...(r[row.parent_id!] || []), row] }));
    } else {
      setItems((l) => [row, ...l]);
      listRef.current?.scrollTo({ top: 0 });
    }
    setText(""); setReplyTo(null); force((n) => n + 1);
  };

  const signIn = () => {
    if (isExpanded) toggleExpanded();
    navigate(`/auth?next=${encodeURIComponent(location.pathname + location.search)}`);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between pl-5 pr-2 pt-1 pb-3">
        <DrawerTitle className="text-2xl font-bold text-foreground">Comments</DrawerTitle>
        <DrawerDescription className="sr-only">Comments on this video</DrawerDescription>
        <div className="flex items-center">
          <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => setShowNote((v) => !v)} aria-label="Comment guidelines" aria-expanded={showNote}><Info className="w-6 h-6" /></Button>
          <Button variant="ghost" size="icon" className="h-11 w-11" onClick={onClose} aria-label="Close comments"><X className="w-6 h-6" /></Button>
        </div>
      </div>
      {user && (
        <div className="flex gap-2 px-5 pb-3" role="radiogroup" aria-label="Sort comments">
          {(["top", "new"] as const).map((s) => (
            <button key={s} role="radio" aria-checked={sort === s} onClick={() => setSort(s)}
              className={`min-h-[40px] px-4 rounded-lg text-[15px] font-medium transition-colors ${sort === s ? "gradient-gold text-primary-foreground font-semibold glow-gold" : "bg-muted/70 text-foreground border border-gold/20 hover:border-gold/50"}`}>
              {s === "top" ? "Top" : "Newest"}
            </button>
          ))}
        </div>
      )}
      {showNote && (
        <p className="bg-muted/60 px-5 py-3 text-[13px] leading-snug text-foreground/90">
          Keep comments kind and respectful. Comments that are hurtful or off-topic may be removed.
        </p>
      )}
      <div ref={listRef} className="relative flex-1 min-h-0 overflow-y-auto px-4 overscroll-contain" data-vaul-no-drag>
        {pending > 0 && (
          <button onClick={showNew} className="sticky top-1 z-10 mx-auto block gradient-gold text-primary-foreground text-sm font-semibold rounded-full px-4 py-2 shadow-lg">
            {pending} new comment{pending > 1 ? "s" : ""}
          </button>
        )}
        {!user ? (
          <p className="text-center text-muted-foreground py-10">Sign in to read and join the conversation.</p>
        ) : !items.length && !loading ? (
          <p className="text-center text-muted-foreground py-10">No comments yet. Start the conversation.</p>
        ) : (
          <ul className="space-y-5 py-3">
            {items.map((c) => (
              <li key={c.id} className="relative">
                {c.reply_count > 0 && <span aria-hidden className="absolute left-[15px] top-10 bottom-[18px] w-px bg-border" />}
                <CommentItem c={c} me={user.id} isAdmin={isAdmin} liked={liked.has(c.id)} onLike={toggleLike} onReply={startReply} onDelete={remove} />
                {replies[c.id] && (
                  <ul className="ml-12 space-y-4 mt-3">
                    {replies[c.id].map((r) => (
                      <li key={r.id}><CommentItem c={r} small me={user.id} isAdmin={isAdmin} liked={liked.has(r.id)} onLike={toggleLike} onReply={startReply} onDelete={remove} /></li>
                    ))}
                  </ul>
                )}
                {c.reply_count > 0 && (
                  <div className="flex items-start pl-[15px]">
                    <span aria-hidden className="w-6 h-[18px] border-l border-b border-border rounded-bl-2xl" />
                    <button onClick={() => openReplies(c)} aria-expanded={!!replies[c.id]}
                      className="ml-2 -mt-1 min-h-[36px] inline-flex items-center gap-1 text-[15px] font-semibold text-foreground">
                      {replies[c.id] ? "Hide replies" : `${c.reply_count} ${c.reply_count === 1 ? "reply" : "replies"}`}
                      <ChevronRight className={`w-4 h-4 transition-transform motion-reduce:transition-none ${replies[c.id] ? "-rotate-90" : ""}`} aria-hidden />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <div ref={sentinel} className="h-8 flex items-center justify-center">{loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" aria-label="Loading" />}</div>
      </div>
      <div className="border-t border-border p-3" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}>
        {!user ? (
          <Button className="w-full h-11 rounded-full" onClick={signIn}>Sign in to comment</Button>
        ) : (
          <>
            {replyTo && (
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>Replying to {authorCache.get(replyTo.user_id)?.username}</span>
                <button className="underline min-h-[32px]" onClick={() => { setReplyTo(null); setText(""); }}>Cancel</button>
              </div>
            )}
            <div className="flex items-end gap-2 rounded-3xl bg-muted pl-4 pr-1 py-1 focus-within:ring-2 focus-within:ring-gold/60">
              <Textarea ref={inputRef} value={text} maxLength={1000} rows={1} placeholder="Add a comment…" aria-label="Add a comment"
                onChange={(e) => setText(e.target.value)}
                className="min-h-[40px] max-h-32 resize-none border-0 bg-transparent px-0 py-2 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 text-[15px]" />
              {text.trim() && (
                <Button onClick={post} disabled={posting} size="icon" className="h-10 w-10 rounded-full gradient-gold text-primary-foreground shrink-0" aria-label="Post comment">
                  {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <SendHorizontal className="w-4 h-4" />}
                </Button>
              )}
            </div>
            {text.length > 900 && <p className="text-xs text-muted-foreground text-right mt-1">{text.length}/1000</p>}
          </>
        )}
      </div>
    </div>
  );
};

const avatarHue = (id: string) => [...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7);

const CommentItem = ({ c, me, isAdmin, liked, onLike, onReply, onDelete, small }: {
  c: VComment; me: string; isAdmin: boolean; liked: boolean; small?: boolean;
  onLike: (c: VComment) => void; onReply: (c: VComment) => void; onDelete: (c: VComment) => void;
}) => {
  const a = authorCache.get(c.user_id);
  const [more, setMore] = useState(false);
  const long = c.body.length > 220 || c.body.split("\n").length > 4;
  const parts = useMemo(() => linkifyComment(c.body), [c.body]);
  const size = small ? "w-6 h-6 text-[11px]" : "w-8 h-8 text-sm";
  const name = a?.username || "Listener";
  if (c.is_deleted) return <p className="text-sm italic text-muted-foreground pl-11 min-h-[32px] flex items-center">Comment deleted</p>;
  return (
    <div className="flex gap-3">
      <Link to={`/user/${c.user_id}`} className="relative z-[1] flex-shrink-0" aria-label={`${name}'s profile`}>
        {a?.avatar_url
          ? <img src={a.avatar_url} alt="" className={`${size} rounded-full object-cover`} />
          : <span className={`${size} rounded-full flex items-center justify-center font-semibold text-foreground`} style={{ backgroundColor: `hsl(${avatarHue(c.user_id)} 55% 38%)` }}>{name[0].toUpperCase()}</span>}
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <p className="flex-1 text-[13px] text-muted-foreground leading-5">
            <Link to={`/user/${c.user_id}`} className="hover:underline">@{name}</Link> • {relativeTime(c.created_at)}
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><button aria-label="More actions" className="-mt-2 -mr-2 h-9 w-9 inline-flex items-center justify-center text-foreground"><MoreVertical className="w-4 h-4" /></button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => { navigator.clipboard?.writeText(c.body); toast.success("Copied"); }}>Copy text</DropdownMenuItem>
              {(c.user_id === me || isAdmin) && <DropdownMenuItem className="text-destructive" onClick={() => onDelete(c)}>Delete</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <p className={`text-[15px] leading-6 text-foreground whitespace-pre-line break-words ${more ? "" : "line-clamp-4"}`}>
          {parts.map((p, i) => (p.href ? <a key={i} href={p.href} className="text-gold underline" target="_blank" rel="noopener noreferrer">{p.text}</a> : <span key={i}>{p.text}</span>))}
        </p>
        {long && <button onClick={() => setMore((v) => !v)} className="text-[15px] text-muted-foreground min-h-[28px]">{more ? "Show less" : "Read more"}</button>}
        <div className="flex items-center gap-6 mt-1 -ml-2">
          <button onClick={() => onLike(c)} aria-pressed={liked} aria-label={liked ? "Remove like" : "Like"} className="min-h-[40px] min-w-[44px] px-2 inline-flex items-center gap-2 text-sm text-foreground">
            <ThumbsUp className={`w-5 h-5 ${liked ? "fill-current text-gold" : ""}`} aria-hidden />{c.like_count > 0 && <span className="tabular-nums">{c.like_count.toLocaleString()}</span>}
          </button>
          <button onClick={() => onReply(c)} aria-label={`Reply to ${name}`} className="min-h-[40px] min-w-[44px] px-2 inline-flex items-center text-foreground"><MessageSquareText className="w-5 h-5" aria-hidden /></button>
        </div>
      </div>
    </div>
  );
};

export default VideoComments;
