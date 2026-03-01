import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProfileUpdateModalProps {
  open: boolean;
  onComplete: () => void;
  userId: string;
  userEmail?: string;
  isKingschatUser: boolean;
  currentProfile: {
    username?: string | null;
    email?: string | null;
    kingschat_handle?: string | null;
    church?: string | null;
    zone?: string | null;
    region?: string | null;
  };
  editMode?: boolean;
}

const ProfileUpdateModal = ({ open, onComplete, userId, userEmail, isKingschatUser, currentProfile, editMode = false }: ProfileUpdateModalProps) => {
  const [displayName, setDisplayName] = useState(currentProfile.username || "");
  const [email, setEmail] = useState(currentProfile.email || "");
  const [kingschatHandle, setKingschatHandle] = useState(currentProfile.kingschat_handle || "");
  const [church, setChurch] = useState(currentProfile.church || "");
  const [zone, setZone] = useState(currentProfile.zone || "");
  const [region, setRegion] = useState(currentProfile.region || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDisplayName(currentProfile.username || "");
    setEmail(currentProfile.email || userEmail || "");
    setKingschatHandle(currentProfile.kingschat_handle || "");
    setChurch(currentProfile.church || "");
    setZone(currentProfile.zone || "");
    setRegion(currentProfile.region || "");
  }, [currentProfile, userEmail]);

  const isKcUser = isKingschatUser;

  // For first-time completion: KC users must provide email, email users must provide KC handle
  // For edit mode: all fields are optional (but display name is always required)
  const displayNameValid = displayName.trim().length > 0;

  const emailRequired = !editMode && isKcUser;
  const emailValid = !emailRequired || (email.trim().length > 0 && email.includes("@") && !email.includes("@kingschat."));

  const kcHandleRequired = !editMode && !isKcUser;
  const kcHandleValid = !kcHandleRequired || kingschatHandle.trim().length > 0;

  const canSubmit = displayNameValid && emailValid && kcHandleValid;

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const updates: Record<string, any> = {
        profile_completed: true,
        username: displayName.trim(),
        church: church.trim() || null,
        zone: zone.trim() || null,
        region: region.trim() || null,
      };

      if (email.trim()) {
        updates.email = email.trim();
      }
      if (kingschatHandle.trim()) {
        updates.kingschat_handle = kingschatHandle.trim();
      }

      const { error } = await supabase.from("profiles").update(updates).eq("user_id", userId);
      if (error) throw error;
      toast.success("Profile updated successfully!");
      onComplete();
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const dismissable = editMode;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && dismissable) onComplete(); }}>
      <DialogContent
        className="sm:max-w-md [&>button]:hidden"
        {...(!dismissable ? {
          onPointerDownOutside: (e: any) => e.preventDefault(),
          onEscapeKeyDown: (e: any) => e.preventDefault(),
        } : {})}
      >
        {dismissable && (
          <button onClick={onComplete} className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 text-muted-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        )}
        <DialogHeader>
          <DialogTitle className="text-center font-serif">{editMode ? "Edit Profile" : "Complete Your Profile"}</DialogTitle>
          <DialogDescription className="text-center">
            {editMode ? "Update your profile details below." : "Please fill in your details to continue using the app."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Display Name - always shown */}
          <div className="space-y-1.5">
            <Label htmlFor="profile-displayname">Display Name <span className="text-destructive">*</span></Label>
            <Input
              id="profile-displayname"
              placeholder="Your display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          {/* Email - always shown, required for KC users on first completion */}
          <div className="space-y-1.5">
            <Label htmlFor="profile-email">
              Email Address {emailRequired && <span className="text-destructive">*</span>}
            </Label>
            <Input
              id="profile-email"
              type="email"
              placeholder="your.email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {emailRequired && !emailValid && email.length > 0 && (
              <p className="text-xs text-destructive">Please enter a valid email address</p>
            )}
          </div>

          {/* KingsChat Handle - always shown, required for email users on first completion */}
          <div className="space-y-1.5">
            <Label htmlFor="profile-kc">
              KingsChat Username {kcHandleRequired && <span className="text-destructive">*</span>}
            </Label>
            <Input
              id="profile-kc"
              placeholder="@username"
              value={kingschatHandle}
              onChange={(e) => setKingschatHandle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="profile-church">Church</Label>
            <Input
              id="profile-church"
              placeholder="e.g. Christ Embassy Lagos"
              value={church}
              onChange={(e) => setChurch(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="profile-zone">Zone</Label>
              <Input
                id="profile-zone"
                placeholder="e.g. Zone A"
                value={zone}
                onChange={(e) => setZone(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-region">Region</Label>
              <Input
                id="profile-region"
                placeholder="e.g. Region 1"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
              />
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!canSubmit || saving}
            className="w-full py-3 rounded-lg gradient-gold text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 mt-2"
          >
            {saving ? "Saving..." : editMode ? "Save Changes" : "Update Profile"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileUpdateModal;
