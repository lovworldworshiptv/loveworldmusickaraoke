import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Send, Reply, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/loading-skeleton";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const AdminFeedback = () => {
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  useEffect(() => {
    if (!adminLoading && !isAdmin) navigate("/");
  }, [isAdmin, adminLoading, navigate]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("admin-feedback")
      .on("postgres_changes", { event: "*", schema: "public", table: "feedback" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-feedback"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const { data: feedbacks = [], isLoading } = useQuery({
    queryKey: ["admin-feedback"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data: fbData, error } = await supabase
        .from("feedback")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Fetch profiles for all unique user_ids
      const userIds = [...new Set(fbData.map((f: any) => f.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username, kingschat_handle, avatar_url")
        .in("user_id", userIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      return fbData.map((f: any) => ({ ...f, profile: profileMap.get(f.user_id) || null }));
    },
  });

  const replyMutation = useMutation({
    mutationFn: async ({ id, reply }: { id: string; reply: string }) => {
      const { error } = await supabase
        .from("feedback")
        .update({ admin_reply: reply, replied_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-feedback"] });
      setReplyingTo(null);
      setReplyText("");
      toast.success("Reply sent!");
    },
    onError: () => toast.error("Failed to send reply"),
  });

  if (adminLoading || !isAdmin) return null;

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 lg:pt-6 max-w-3xl">
        <h2 className="text-2xl font-serif font-bold text-foreground mb-4 flex items-center gap-2">
          <MessageSquare className="w-6 h-6" /> User Feedback
        </h2>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading...</p>
        ) : feedbacks.length === 0 ? (
          <EmptyState icon={MessageSquare} title="No feedback yet" description="User feedback will appear here" />
        ) : (
          <div className="space-y-4">
            {feedbacks.map((fb: any) => {
              const profile = fb.profile;
              const displayName = profile?.username || "Unknown User";
              const handle = profile?.kingschat_handle;

              return (
                <div key={fb.id} className="p-4 rounded-xl border border-border bg-card space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                      {profile?.avatar_url ? (
                        <img src={profile.avatar_url} className="w-9 h-9 rounded-full object-cover" alt="" />
                      ) : (
                        <User className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">{displayName}</span>
                        {handle && <span className="text-xs text-muted-foreground">@{handle}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground">{new Date(fb.created_at).toLocaleString()}</p>
                      <p className="text-sm text-foreground mt-2">{fb.message}</p>
                    </div>
                  </div>

                  {fb.admin_reply && (
                    <div className="ml-12 p-3 rounded-lg bg-primary/10 border border-primary/20">
                      <p className="text-xs font-semibold text-primary mb-1 flex items-center gap-1">
                        <Reply className="w-3 h-3" /> Admin Reply
                      </p>
                      <p className="text-sm text-foreground">{fb.admin_reply}</p>
                      <p className="text-xs text-muted-foreground mt-1">{new Date(fb.replied_at).toLocaleString()}</p>
                    </div>
                  )}

                  {replyingTo === fb.id ? (
                    <div className="ml-12 space-y-2">
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Type your reply..."
                        className="w-full min-h-[80px] px-3 py-2 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={!replyText.trim() || replyMutation.isPending}
                          onClick={() => replyMutation.mutate({ id: fb.id, reply: replyText.trim() })}
                          className="gradient-gold text-primary-foreground gap-1"
                        >
                          <Send className="w-3 h-3" /> Send Reply
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setReplyingTo(null); setReplyText(""); }}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="ml-12">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-xs"
                        onClick={() => { setReplyingTo(fb.id); setReplyText(fb.admin_reply || ""); }}
                      >
                        <Reply className="w-3 h-3" /> {fb.admin_reply ? "Edit Reply" : "Reply"}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="h-8" />
    </AppLayout>
  );
};

export default AdminFeedback;
