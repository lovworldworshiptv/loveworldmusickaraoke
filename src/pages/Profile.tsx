import { useState, useEffect, useRef } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Crown, Shield, LogOut, ChevronRight, AtSign, Trash2, Camera, Sparkles, Edit, Settings, Palette } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import ProfileUpdateModal from "@/components/profile/ProfileUpdateModal";
import MyKaraoke from "@/components/profile/MyKaraoke";
import { useTheme, ThemeName } from "@/contexts/ThemeContext";

const Profile = () => {
  const { user, username, avatarUrl, kingschatHandle, profileData, signOut, loading, markProfileCompleted, refetchProfile } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<string>("user");
  const [subscription, setSubscription] = useState<string>("free");
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [localAvatar, setLocalAvatar] = useState<string | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const handleAvatarUpload = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/avatar.${ext}`;
      await supabase.storage.from("avatars").remove([path]).catch(() => {});
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = `${publicUrl}?t=${Date.now()}`;
      await supabase.from("profiles").update({ avatar_url: url }).eq("user_id", user.id);
      setLocalAvatar(url);
      toast.success("Profile picture updated!");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user) return;
    setUploading(true);
    try {
      const { data: files } = await supabase.storage.from("avatars").list(user.id);
      if (files && files.length > 0) {
        await supabase.storage.from("avatars").remove(files.map(f => `${user.id}/${f.name}`));
      }
      await supabase.from("profiles").update({ avatar_url: null }).eq("user_id", user.id);
      setLocalAvatar(null);
      toast.success("Profile picture removed");
    } catch (err: any) {
      toast.error(err.message || "Failed to remove");
    } finally {
      setUploading(false);
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

  const displayAvatar = localAvatar ?? avatarUrl;

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

  const roleLabel = role === "admin" ? "Admin" : role === "editor" ? "Editor" : "User";
  const subscriptionLabel = subscription === "premium" ? "Premium" : subscription === "trial" ? "Trial" : "Free";
  const roleColor = role === "admin" ? "text-destructive" : role === "editor" ? "text-primary" : "text-muted-foreground";
  const subscriptionColor = subscription === "premium" ? "text-gold" : subscription === "trial" ? "text-gold" : "text-muted-foreground";
  const isKingschatUser = !!(user.email?.includes("@kingschat."));

  const menuItems = [
    { label: "Edit Profile", path: "", icon: Edit, action: () => setEditModalOpen(true) },
    { label: "My Favorites", path: "/library", icon: ChevronRight },
    { label: "My Playlists", path: "/library", icon: ChevronRight },
    { label: subscription === "premium" ? "Manage Subscription" : "Upgrade to Premium", path: "/subscription", icon: Crown },
    ...(role === "admin" ? [{ label: "Admin Panel", path: "/admin/songs", icon: Shield }] : []),
  ];

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 lg:pt-6 max-w-md mx-auto">
        {/* Avatar & Info */}
        <div className="glass-card p-6 text-center mb-6">
          <div className="relative w-20 h-20 mx-auto mb-4">
            {displayAvatar ? (
              <img src={displayAvatar} alt={username} className="w-20 h-20 rounded-full object-cover border-2 border-primary" />
            ) : (
              <div className="w-20 h-20 rounded-full gradient-gold flex items-center justify-center text-primary-foreground text-2xl font-serif font-bold">
                {username.charAt(0).toUpperCase()}
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:opacity-90"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); }}
            />
          </div>
          {displayAvatar && (
            <button onClick={handleRemoveAvatar} disabled={uploading} className="text-xs text-destructive hover:underline mb-2">
              Remove photo
            </button>
          )}
          <h2 className="text-xl font-serif font-bold text-foreground">Welcome Esteemed</h2>
          <p className="text-lg gradient-gold-text font-bold">{username}</p>
          {kingschatHandle && (
            <p className="flex items-center justify-center gap-1 text-sm text-muted-foreground mt-1">
              <AtSign className="w-3.5 h-3.5" />{kingschatHandle}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1">{user.email?.includes("@kingschat.local") ? "" : user.email}</p>

          {/* Church/Zone/Region info */}
          {(profileData.church || profileData.zone || profileData.region) && (
            <div className="flex items-center justify-center gap-2 mt-2 text-xs text-muted-foreground flex-wrap">
              {profileData.church && <span>{profileData.church}</span>}
              {profileData.zone && <><span>•</span><span>{profileData.zone}</span></>}
              {profileData.region && <><span>•</span><span>{profileData.region}</span></>}
            </div>
          )}

          <div className="flex items-center gap-2 mt-3 justify-center flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-xs font-semibold ${roleColor}`}>
              {(role === "admin" || role === "editor") && <Shield className="w-3.5 h-3.5" />}
              {role === "user" && <User className="w-3.5 h-3.5" />}
              {roleLabel}
            </span>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-xs font-semibold ${subscriptionColor}`}>
              {subscription === "premium" ? <Crown className="w-3.5 h-3.5" /> : subscription === "trial" ? <Sparkles className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
              {subscriptionLabel}
            </span>
          </div>
        </div>

        {/* My Karaoke */}
        <MyKaraoke />

        {/* Menu */}
        <div className="space-y-2 mb-6">
          {menuItems.map((item) => (
            <button
              key={item.label}
              onClick={() => item.action ? item.action() : navigate(item.path)}
              className="w-full flex items-center justify-between p-4 glass-card hover:glow-gold transition-all duration-200"
            >
              <span className="text-sm font-medium text-foreground">{item.label}</span>
              <item.icon className="w-4 h-4 text-muted-foreground" />
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
                This action is <strong>permanent and irreversible</strong>. All your data — including favorites, playlists, game progress, and profile — will be permanently deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteAccount} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {deleting ? "Deleting..." : "Yes, delete my account"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <div className="h-8" />

      {/* Edit Profile Modal */}
      {user && (
        <ProfileUpdateModal
          open={editModalOpen}
          onComplete={() => {
            setEditModalOpen(false);
            markProfileCompleted();
            refetchProfile();
          }}
          userId={user.id}
          userEmail={user.email}
          isKingschatUser={isKingschatUser}
          currentProfile={profileData}
          editMode={true}
        />
      )}
    </AppLayout>
  );
};

export default Profile;
