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
  userEmail: string | undefined;
  isKingschatUser: boolean;
  currentProfile: {
    email?: string | null;
    kingschat_handle?: string | null;
    church?: string | null;
    zone?: string | null;
    region?: string | null;
  };
}

const ProfileUpdateModal = ({ open, onComplete, userId, userEmail, isKingschatUser, currentProfile }: ProfileUpdateModalProps) => {
  const [email, setEmail] = useState(currentProfile.email || "");
  const [kingschatHandle, setKingschatHandle] = useState(currentProfile.kingschat_handle || "");
  const [church, setChurch] = useState(currentProfile.church || "");
  const [zone, setZone] = useState(currentProfile.zone || "");
  const [region, setRegion] = useState(currentProfile.region || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEmail(currentProfile.email || userEmail || "");
    setKingschatHandle(currentProfile.kingschat_handle || "");
    setChurch(currentProfile.church || "");
    setZone(currentProfile.zone || "");
    setRegion(currentProfile.region || "");
  }, [currentProfile, userEmail]);

  // For KingsChat users, email is required. For email users, nothing extra is strictly required.
  const isKcUser = isKingschatUser;
  const emailRequired = isKcUser;
  const emailValid = !emailRequired || (email.trim().length > 0 && email.includes("@") && !email.includes("@kingschat."));
  const canSubmit = emailValid;

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const updates: Record<string, any> = {
        profile_completed: true,
        church: church.trim() || null,
        zone: zone.trim() || null,
        region: region.trim() || null,
      };

      if (isKcUser && email.trim()) {
        updates.email = email.trim();
      }
      if (!isKcUser && kingschatHandle.trim()) {
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

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md [&>button]:hidden" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-center font-serif">Complete Your Profile</DialogTitle>
          <DialogDescription className="text-center">
            Please fill in your details to continue using the app.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {isKcUser ? (
            <div className="space-y-1.5">
              <Label htmlFor="profile-email">Email Address <span className="text-destructive">*</span></Label>
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
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="profile-kc">KingsChat Username</Label>
              <Input
                id="profile-kc"
                placeholder="@username"
                value={kingschatHandle}
                onChange={(e) => setKingschatHandle(e.target.value)}
              />
            </div>
          )}

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
            {saving ? "Saving..." : "Update Profile"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileUpdateModal;
