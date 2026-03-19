import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Send, Search, X, Users, User } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface UserOption {
  user_id: string;
  username: string;
  email: string | null;
  kingschat_handle: string | null;
  avatar_url: string | null;
}

interface SendMessageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-selected user for single direct message */
  targetUser?: { user_id: string; username: string } | null;
}

const SendMessageModal = ({ open, onOpenChange, targetUser }: SendMessageModalProps) => {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [deepLink, setDeepLink] = useState("");
  const [actionUrl, setActionUrl] = useState("");
  const [sending, setSending] = useState(false);

  // Multi-user search
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<UserOption[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<UserOption[]>([]);
  const [searching, setSearching] = useState(false);

  const isBulk = !targetUser;

  useEffect(() => {
    if (targetUser && open) {
      setSelectedUsers([{ user_id: targetUser.user_id, username: targetUser.username, email: null, kingschat_handle: null, avatar_url: null }]);
    }
    if (!open) {
      setTitle("");
      setMessage("");
      setImageUrl("");
      setDeepLink("");
      setSearch("");
      setSearchResults([]);
      setSelectedUsers([]);
    }
  }, [open, targetUser]);

  const handleSearch = async (q: string) => {
    setSearch(q);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    const { data } = await supabase
      .from("profiles")
      .select("user_id, username, email, kingschat_handle, avatar_url")
      .or(`username.ilike.%${q}%,email.ilike.%${q}%,kingschat_handle.ilike.%${q}%`)
      .limit(20);
    setSearchResults(data || []);
    setSearching(false);
  };

  const toggleUser = (u: UserOption) => {
    setSelectedUsers(prev =>
      prev.find(s => s.user_id === u.user_id)
        ? prev.filter(s => s.user_id !== u.user_id)
        : [...prev, u]
    );
  };

  const removeUser = (userId: string) => {
    setSelectedUsers(prev => prev.filter(s => s.user_id !== userId));
  };

  const handleSend = async () => {
    if (!title.trim() || !message.trim() || selectedUsers.length === 0) return;
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const targetIds = selectedUsers.map(u => u.user_id);

      const res = await supabase.functions.invoke("send-notification", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          title: title.trim(),
          message: message.trim(),
          image_url: imageUrl.trim() || undefined,
          deep_link: deepLink.trim() || undefined,
          action_url: actionUrl.trim() || undefined,
          segment: "direct",
          target_user_ids: targetIds,
        },
      });

      if (res.error) throw res.error;
      toast.success(`Message sent to ${selectedUsers.length} user(s)`);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5 text-primary" />
            {isBulk ? "Send Bulk Message" : `Message ${targetUser?.username}`}
          </DialogTitle>
          <DialogDescription>
            {isBulk ? "Search and select users to send a notification to." : "Send a direct notification to this user."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* User search (bulk mode) */}
          {isBulk && (
            <div className="space-y-2">
              <Label>Recipients</Label>
              {/* Selected chips */}
              {selectedUsers.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {selectedUsers.map(u => (
                    <span key={u.user_id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                      {u.username}
                      <button onClick={() => removeUser(u.user_id)} className="hover:text-destructive">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or KingsChat handle..."
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              {search.trim().length >= 2 && (
                <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-background">
                  {searching ? (
                    <p className="text-xs text-muted-foreground text-center py-3">Searching...</p>
                  ) : searchResults.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-3">No users found</p>
                  ) : (
                    searchResults.map(u => {
                      const isSelected = selectedUsers.some(s => s.user_id === u.user_id);
                      return (
                        <button
                          key={u.user_id}
                          onClick={() => toggleUser(u)}
                          className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/50 transition-colors ${isSelected ? "bg-primary/5" : ""}`}
                        >
                          <Checkbox checked={isSelected} className="pointer-events-none" />
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                              {u.username.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{u.username}</p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {u.kingschat_handle ? `@${u.kingschat_handle}` : u.email || ""}
                            </p>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}

          {!isBulk && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">{targetUser?.username}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="msg-title">Title <span className="text-destructive">*</span></Label>
            <Input id="msg-title" placeholder="Notification title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="msg-body">Message <span className="text-destructive">*</span></Label>
            <Textarea id="msg-body" placeholder="Write your message..." value={message} onChange={(e) => setMessage(e.target.value)} rows={3} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="msg-image">Image URL (optional)</Label>
            <Input id="msg-image" placeholder="https://..." value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="msg-link">Deep Link (optional)</Label>
            <Input id="msg-link" placeholder="https://..." value={deepLink} onChange={(e) => setDeepLink(e.target.value)} />
          </div>

          <Button onClick={handleSend} disabled={sending || !title.trim() || !message.trim() || selectedUsers.length === 0} className="w-full">
            {sending ? "Sending..." : `Send to ${selectedUsers.length} user(s)`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SendMessageModal;
