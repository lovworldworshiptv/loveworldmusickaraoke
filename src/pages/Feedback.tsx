import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Send, Reply } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/loading-skeleton";
import { toast } from "sonner";

const Feedback = () => {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const queryClient = useQueryClient();

  // Realtime subscription for replies
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("user-feedback")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "feedback", filter: `user_id=eq.${user.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["feedback", user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  const { data: feedbacks = [], isLoading } = useQuery({
    queryKey: ["feedback", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feedback")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const submitFeedback = useMutation({
    mutationFn: async (msg: string) => {
      const { error } = await supabase.from("feedback").insert({ message: msg, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feedback"] });
      setMessage("");
      toast.success("Thank you for your feedback!");
    },
    onError: () => toast.error("Failed to submit feedback"),
  });

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 lg:pt-6 max-w-2xl">
        <h2 className="text-2xl font-serif font-bold text-foreground mb-4">Feedback</h2>

        {!user ? (
          <EmptyState icon={MessageSquare} title="Sign in to send feedback" description="We'd love to hear from you" />
        ) : (
          <>
            <form onSubmit={(e) => { e.preventDefault(); if (message.trim()) submitFeedback.mutate(message.trim()); }}
              className="mb-6 space-y-3">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us what you think, report a bug, or suggest a feature..."
                className="w-full min-h-[120px] px-4 py-3 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <Button type="submit" disabled={!message.trim() || submitFeedback.isPending} className="gradient-gold text-primary-foreground gap-2">
                <Send className="w-4 h-4" /> Submit Feedback
              </Button>
            </form>

            {feedbacks.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">Your previous feedback</h3>
                {feedbacks.map((fb: any) => (
                  <div key={fb.id} className="p-4 rounded-xl border border-border bg-muted/30 space-y-2">
                    <p className="text-sm text-foreground">{fb.message}</p>
                    <p className="text-xs text-muted-foreground">{new Date(fb.created_at).toLocaleDateString()}</p>
                    {fb.admin_reply && (
                      <div className="mt-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
                        <p className="text-xs font-semibold text-primary mb-1 flex items-center gap-1">
                          <Reply className="w-3 h-3" /> Admin Reply
                        </p>
                        <p className="text-sm text-foreground">{fb.admin_reply}</p>
                        <p className="text-xs text-muted-foreground mt-1">{new Date(fb.replied_at).toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      <div className="h-8" />
    </AppLayout>
  );
};

export default Feedback;
