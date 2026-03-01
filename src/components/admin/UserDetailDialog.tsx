import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Crown, User, Shield, Clock, Mail, Calendar, Music, Heart, Sparkles } from "lucide-react";

interface UserDetailDialogProps {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface UserDetail {
  username: string;
  email: string | null;
  avatar_url: string | null;
  kingschat_handle: string | null;
  created_at: string;
  role: string;
  subscription: string;
  subscription_plan: string | null;
  subscription_start_date: string | null;
  subscription_expiry_date: string | null;
  favorites_count: number;
  recently_played_count: number;
  playlists_count: number;
  feedback_count: number;
}

const UserDetailDialog = ({ userId, open, onOpenChange }: UserDetailDialogProps) => {
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId || !open) return;
    setLoading(true);

    const fetchAll = async () => {
      const [profileRes, roleRes, subRes, favRes, recentRes, playlistRes, feedbackRes] = await Promise.all([
        supabase.from("profiles").select("username, email, avatar_url, kingschat_handle, created_at").eq("user_id", userId).single(),
        supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
        supabase.from("user_subscriptions").select("subscription, subscription_plan, subscription_start_date, subscription_expiry_date").eq("user_id", userId).maybeSingle(),
        supabase.from("favorites").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("recently_played").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("playlists").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("feedback").select("id", { count: "exact", head: true }).eq("user_id", userId),
      ]);

      const p = profileRes.data;
      if (!p) { setLoading(false); return; }

      setDetail({
        username: p.username,
        email: p.email,
        avatar_url: p.avatar_url,
        kingschat_handle: p.kingschat_handle,
        created_at: p.created_at,
        role: roleRes.data?.role || "user",
        subscription: subRes.data?.subscription || "free",
        subscription_plan: subRes.data?.subscription_plan || null,
        subscription_start_date: subRes.data?.subscription_start_date || null,
        subscription_expiry_date: subRes.data?.subscription_expiry_date || null,
        favorites_count: favRes.count || 0,
        recently_played_count: recentRes.count || 0,
        playlists_count: playlistRes.count || 0,
        feedback_count: feedbackRes.count || 0,
      });
      setLoading(false);
    };

    fetchAll();
  }, [userId, open]);

  const subIcon = (sub: string) => {
    if (sub === "premium") return <Crown className="w-4 h-4 text-gold" />;
    if (sub === "trial") return <Sparkles className="w-4 h-4 text-gold" />;
    return <User className="w-4 h-4 text-muted-foreground" />;
  };

  const roleIcon = (role: string) => {
    if (role === "admin") return <Shield className="w-4 h-4 text-destructive" />;
    if (role === "editor") return <Shield className="w-4 h-4 text-primary" />;
    return <User className="w-4 h-4 text-muted-foreground" />;
  };

  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>User Details</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
        ) : detail ? (
          <div className="space-y-5">
            {/* Avatar & Name */}
            <div className="flex items-center gap-4">
              {detail.avatar_url ? (
                <img src={detail.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-lg font-bold text-foreground">
                  {detail.username.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-lg font-semibold text-foreground">{detail.username}</p>
                {detail.email && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Mail className="w-3 h-3" /> {detail.email}
                  </p>
                )}
                {detail.kingschat_handle && (
                  <p className="text-xs text-muted-foreground">KC: @{detail.kingschat_handle}</p>
                )}
              </div>
            </div>

            {/* Role & Subscription badges */}
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="flex items-center gap-1 text-xs">
                {roleIcon(detail.role)} {detail.role.charAt(0).toUpperCase() + detail.role.slice(1)}
              </Badge>
              <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                {subIcon(detail.subscription)} {detail.subscription.charAt(0).toUpperCase() + detail.subscription.slice(1)}
              </Badge>
            </div>

            {/* Subscription details */}
            <div className="rounded-lg border border-border p-3 space-y-2 text-sm">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Subscription</h4>
              <div className="grid grid-cols-2 gap-y-1.5 text-sm">
                <span className="text-muted-foreground">Plan</span>
                <span className="text-foreground">{detail.subscription_plan || "None"}</span>
                <span className="text-muted-foreground">Start</span>
                <span className="text-foreground">{formatDate(detail.subscription_start_date)}</span>
                <span className="text-muted-foreground">Expiry</span>
                <span className="text-foreground">{formatDate(detail.subscription_expiry_date)}</span>
              </div>
            </div>

            {/* Activity stats */}
            <div className="rounded-lg border border-border p-3 space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Activity</h4>
              <div className="grid grid-cols-2 gap-y-1.5 text-sm">
                <span className="text-muted-foreground flex items-center gap-1"><Heart className="w-3 h-3" /> Favorites</span>
                <span className="text-foreground">{detail.favorites_count}</span>
                <span className="text-muted-foreground flex items-center gap-1"><Music className="w-3 h-3" /> Recently Played</span>
                <span className="text-foreground">{detail.recently_played_count}</span>
                <span className="text-muted-foreground flex items-center gap-1"><Music className="w-3 h-3" /> Playlists</span>
                <span className="text-foreground">{detail.playlists_count}</span>
                <span className="text-muted-foreground">Feedback</span>
                <span className="text-foreground">{detail.feedback_count}</span>
              </div>
            </div>

            {/* Joined date */}
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Joined {formatDate(detail.created_at)}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">User not found</p>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default UserDetailDialog;
