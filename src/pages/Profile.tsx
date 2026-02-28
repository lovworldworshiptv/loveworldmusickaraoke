import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Crown, Shield, LogOut, ChevronRight, AtSign, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/sonner";

const Profile = () => {
  const { user, username, avatarUrl, kingschatHandle, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<string>("user");
  const [subscription, setSubscription] = useState<string>("free");
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const res = await supabase.functions.invoke("delete-account", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.error) throw res.error;

      toast.success("Account deleted successfully");
      await signOut();
      navigate("/");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete account");
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    if (user) {
      supabase.from("user_roles").select("role").eq("user_id", user.id).single()
        .then(({ data }) => { if (data) setRole(data.role); });
      supabase.from("user_subscriptions").select("subscription").eq("user_id", user.id).single()
        .then(({ data }) => { if (data) setSubscription(data.subscription); });
    }
  }, [user]);

  if (loading) {
    return <AppLayout><div className="p-6 text-center text-muted-foreground">Loading...</div></AppLayout>;
  }

  if (!user) {
    return (
      <AppLayout>
        <div className="px-4 lg:px-6 pt-4 lg:pt-6 max-w-md mx-auto text-center">
          <div className="glass-card p-8">
            <div className="w-20 h-20 rounded-full gradient-purple flex items-center justify-center mx-auto mb-4">
              <User className="w-10 h-10 text-gold/40" />
            </div>
            <h2 className="text-xl font-serif font-bold text-foreground mb-2">Welcome to Loveworld Music Karaoke+</h2>
            <p className="text-sm text-muted-foreground mb-6">Sign in to access your profile, favorites, and playlists.</p>
            <button
              onClick={() => navigate("/auth")}
              className="gradient-gold text-primary-foreground px-8 py-3 rounded-full text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Sign In
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const roleIcon = role === "admin" ? Shield : role === "editor" ? Shield : User;
  const subscriptionIcon = subscription === "premium" ? Crown : User;
  const roleLabel = role === "admin" ? "Admin" : role === "editor" ? "Editor" : "User";
  const subscriptionLabel = subscription === "premium" ? "Premium" : "Free";
  const roleColor = role === "admin" ? "text-destructive" : role === "editor" ? "text-primary" : "text-muted-foreground";
  const subscriptionColor = subscription === "premium" ? "text-gold" : "text-muted-foreground";

  const menuItems = [
    { label: "My Favorites", path: "/library", icon: ChevronRight },
    { label: "My Playlists", path: "/library", icon: ChevronRight },
    ...(role === "admin" ? [{ label: "Admin Panel", path: "/admin/songs", icon: Shield }] : []),
  ];

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 lg:pt-6 max-w-md mx-auto">
        {/* Avatar & Info */}
        <div className="glass-card p-6 text-center mb-6">
          {avatarUrl ? (
            <img src={avatarUrl} alt={username} className="w-20 h-20 rounded-full mx-auto mb-4 object-cover border-2 border-primary" />
          ) : (
            <div className="w-20 h-20 rounded-full gradient-gold flex items-center justify-center mx-auto mb-4 text-primary-foreground text-2xl font-serif font-bold">
              {username.charAt(0).toUpperCase()}
            </div>
          )}
          <h2 className="text-xl font-serif font-bold text-foreground">Welcome Esteemed</h2>
          <p className="text-lg gradient-gold-text font-bold">{username}</p>
          {kingschatHandle && (
            <p className="flex items-center justify-center gap-1 text-sm text-muted-foreground mt-1">
              <AtSign className="w-3.5 h-3.5" />{kingschatHandle}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1">{user.email?.includes("@kingschat.local") ? "" : user.email}</p>
          <div className="flex items-center gap-2 mt-3 justify-center flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-xs font-semibold ${roleColor}`}>
              {role === "admin" && <Shield className="w-3.5 h-3.5" />}
              {role === "editor" && <Shield className="w-3.5 h-3.5" />}
              {role === "user" && <User className="w-3.5 h-3.5" />}
              {roleLabel}
            </span>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-xs font-semibold ${subscriptionColor}`}>
              {subscription === "premium" ? <Crown className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
              {subscriptionLabel}
            </span>
          </div>
        </div>

        {/* Menu */}
        <div className="space-y-2 mb-6">
          {menuItems.map((item) => (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className="w-full flex items-center justify-between p-4 glass-card hover:glow-gold transition-all duration-200"
            >
              <span className="text-sm font-medium text-foreground">{item.label}</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          ))}
        </div>

        {/* Sign Out */}
        <button
          onClick={async () => { await signOut(); navigate("/"); }}
          className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors text-sm font-medium"
        >
          <LogOut className="w-4 h-4" /> Sign Out
        </button>

        {/* Delete Account */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border border-destructive/50 text-destructive hover:bg-destructive/10 transition-colors text-sm font-medium mt-3">
              <Trash2 className="w-4 h-4" /> Delete Account
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription>
                This action is <strong>permanent and irreversible</strong>. All your data — including favorites, playlists, game progress, and profile — will be permanently deleted. You will not be able to recover your account.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? "Deleting..." : "Yes, delete my account"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <div className="h-8" />
    </AppLayout>
  );
};

export default Profile;
