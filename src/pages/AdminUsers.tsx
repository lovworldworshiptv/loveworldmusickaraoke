import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Users, Shield, Crown, User, Search, Trash2, Clock, MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import UserDetailDialog from "@/components/admin/UserDetailDialog";
import SendMessageModal from "@/components/admin/SendMessageModal";

interface UserRow {
  user_id: string;
  username: string;
  avatar_url: string | null;
  kingschat_handle: string | null;
  email: string | null;
  role: string;
  subscription: string;
  subscription_expiry_date: string | null;
  created_at: string;
}

const PLANS = [
  { value: "3_day_trial", label: "3-Day Trial", days: 3 },
  { value: "1_month", label: "1 Month (2 ESP)", days: 30 },
  { value: "6_months", label: "6 Months (10 ESP)", days: 180 },
  { value: "1_year", label: "1 Year (15 ESP)", days: 365 },
];

const AdminUsers = () => {
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("1_month");
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  const [detailUserId, setDetailUserId] = useState<string | null>(null);

  // Messaging state
  const [messageTarget, setMessageTarget] = useState<{ user_id: string; username: string } | null>(null);
  const [bulkMessageOpen, setBulkMessageOpen] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    const { data: profiles, error: pErr } = await supabase
      .from("profiles")
      .select("user_id, username, avatar_url, kingschat_handle, email, created_at")
      .order("created_at", { ascending: false });

    if (pErr || !profiles) {
      toast.error("Failed to load users");
      setLoading(false);
      return;
    }

    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    const { data: subs } = await supabase.from("user_subscriptions").select("user_id, subscription, subscription_expiry_date");

    const roleMap = new Map<string, string>();
    (roles || []).forEach((r: any) => roleMap.set(r.user_id, r.role));

    const subMap = new Map<string, { subscription: string; expiry: string | null }>();
    (subs || []).forEach((s: any) => subMap.set(s.user_id, { subscription: s.subscription, expiry: s.subscription_expiry_date }));

    const merged: UserRow[] = profiles.map((p: any) => ({
      user_id: p.user_id,
      username: p.username,
      avatar_url: p.avatar_url,
      kingschat_handle: p.kingschat_handle,
      email: p.email,
      role: roleMap.get(p.user_id) || "user",
      subscription: subMap.get(p.user_id)?.subscription || "free",
      subscription_expiry_date: subMap.get(p.user_id)?.expiry || null,
      created_at: p.created_at,
    }));

    setUsers(merged);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) fetchUsers();
  }, [isAdmin]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdatingId(userId);
    const { error } = await supabase.from("user_roles").update({ role: newRole as any }).eq("user_id", userId);
    if (error) { toast.error("Failed to update role"); setUpdatingId(null); return; }
    toast.success("Role updated");
    setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, role: newRole } : u));
    setUpdatingId(null);
  };

  const handleSubscriptionChange = (userId: string, newSub: string) => {
    if (newSub === "premium") {
      setPendingUserId(userId);
      setSelectedPlan("1_month");
      setPlanModalOpen(true);
    } else if (newSub === "trial") {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 3);
      confirmSubscriptionChange(userId, "trial", "3_day_trial", expiry.toISOString());
    } else {
      confirmSubscriptionChange(userId, newSub, null, null);
    }
  };

  const confirmSubscriptionChange = async (userId: string, newSub: string, plan: string | null, expiryDate: string | null) => {
    setUpdatingId(userId);
    const updateData: any = {
      subscription: newSub as any,
      subscription_plan: plan || "none",
      subscription_start_date: newSub === "premium" ? new Date().toISOString() : null,
      subscription_expiry_date: expiryDate,
    };
    const { error } = await supabase.from("user_subscriptions").update(updateData).eq("user_id", userId);
    if (error) {
      const { error: insertErr } = await supabase.from("user_subscriptions").insert({ user_id: userId, ...updateData });
      if (insertErr) { toast.error("Failed to update subscription"); setUpdatingId(null); return; }
    }
    toast.success(newSub === "premium" ? "Premium activated" : newSub === "trial" ? "Trial activated" : "Subscription reverted to free");
    setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, subscription: newSub, subscription_expiry_date: expiryDate } : u));
    setUpdatingId(null);
  };

  const handleConfirmPremium = () => {
    if (!pendingUserId) return;
    const plan = PLANS.find(p => p.value === selectedPlan);
    if (!plan) return;
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + plan.days);
    confirmSubscriptionChange(pendingUserId, "premium", plan.value, expiry.toISOString());
    setPlanModalOpen(false);
    setPendingUserId(null);
  };

  const handleDeleteUser = async (userId: string) => {
    const { error } = await supabase.functions.invoke("delete-account", { body: { targetUserId: userId } });
    if (error) { toast.error("Failed to delete user"); return; }
    toast.success("User deleted");
    setUsers(prev => prev.filter(u => u.user_id !== userId));
  };

  const roleIcon = (role: string) => {
    if (role === "admin") return <Shield className="w-3.5 h-3.5 text-destructive" />;
    if (role === "editor") return <Shield className="w-3.5 h-3.5 text-primary" />;
    return <User className="w-3.5 h-3.5 text-muted-foreground" />;
  };

  if (adminLoading) return <AppLayout><div className="p-6 text-center text-muted-foreground">Loading...</div></AppLayout>;
  if (!isAdmin) return <AppLayout><div className="p-6 text-center text-muted-foreground">Admin access required.</div></AppLayout>;

  const filtered = users.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.user_id.toLowerCase().includes(search.toLowerCase()) ||
    (u.kingschat_handle || "").toLowerCase().includes(search.toLowerCase()) ||
    (u.email || "").toLowerCase().includes(search.toLowerCase())
  );

  const pendingUser = users.find(u => u.user_id === pendingUserId);

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 lg:pt-6 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-gold" />
            <h2 className="text-2xl font-serif font-bold text-foreground">Manage Users</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setBulkMessageOpen(true)} className="gap-1.5">
              <Send className="w-4 h-4" /> Bulk Message
            </Button>
            <span className="text-sm text-muted-foreground">{users.length} users</span>
          </div>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text" placeholder="Search by name, email, or KingsChat handle..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-muted border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {loading ? (
          <p className="text-muted-foreground text-sm text-center py-12">Loading users...</p>
        ) : (
          <div className="glass-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Subscription</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(user => (
                  <TableRow key={user.user_id} className="cursor-pointer" onClick={() => setDetailUserId(user.user_id)}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-foreground">
                            {user.username.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-foreground">{user.username}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {user.kingschat_handle ? `@${user.kingschat_handle}` : user.email || user.user_id.slice(0, 8) + "…"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select value={user.role} onValueChange={(v) => handleRoleChange(user.user_id, v)} disabled={updatingId === user.user_id}>
                        <SelectTrigger className="w-[110px] h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user"><span className="flex items-center gap-1.5"><User className="w-3 h-3" /> User</span></SelectItem>
                          <SelectItem value="editor"><span className="flex items-center gap-1.5"><Shield className="w-3 h-3 text-primary" /> Editor</span></SelectItem>
                          <SelectItem value="admin"><span className="flex items-center gap-1.5"><Shield className="w-3 h-3 text-destructive" /> Admin</span></SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select value={user.subscription} onValueChange={(v) => handleSubscriptionChange(user.user_id, v)} disabled={updatingId === user.user_id}>
                        <SelectTrigger className="w-[110px] h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="free"><span className="flex items-center gap-1.5"><User className="w-3 h-3" /> Free</span></SelectItem>
                          <SelectItem value="trial"><span className="flex items-center gap-1.5"><Clock className="w-3 h-3 text-orange-400" /> Trial</span></SelectItem>
                          <SelectItem value="premium"><span className="flex items-center gap-1.5"><Crown className="w-3 h-3 text-gold" /> Premium</span></SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {(user.subscription === "premium" || user.subscription === "trial") && user.subscription_expiry_date
                          ? new Date(user.subscription_expiry_date).toLocaleDateString() : "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">{new Date(user.created_at).toLocaleDateString()}</span>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setMessageTarget({ user_id: user.user_id, username: user.username })}
                          className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                          title="Send message"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Delete user">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete user "{user.username}"?</AlertDialogTitle>
                              <AlertDialogDescription>This will permanently delete this user and all their data. This action cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteUser(user.user_id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
      <div className="h-8" />

      {/* Premium Plan Selection Modal */}
      <Dialog open={planModalOpen} onOpenChange={(open) => { if (!open) { setPlanModalOpen(false); setPendingUserId(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Crown className="w-5 h-5 text-gold" /> Activate Premium</DialogTitle>
            <DialogDescription>Select a subscription plan for <strong>{pendingUser?.username}</strong></DialogDescription>
          </DialogHeader>
          <RadioGroup value={selectedPlan} onValueChange={setSelectedPlan} className="space-y-3 mt-2">
            {PLANS.map(plan => (
              <div key={plan.value} className="flex items-center space-x-3">
                <RadioGroupItem value={plan.value} id={plan.value} />
                <Label htmlFor={plan.value} className="flex-1 cursor-pointer text-sm">
                  <span className="font-medium text-foreground">{plan.label}</span>
                  <span className="block text-xs text-muted-foreground">{plan.days} days</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => { setPlanModalOpen(false); setPendingUserId(null); }}>Cancel</Button>
            <Button className="flex-1" onClick={handleConfirmPremium}>Confirm</Button>
          </div>
        </DialogContent>
      </Dialog>

      <UserDetailDialog userId={detailUserId} open={!!detailUserId} onOpenChange={(open) => { if (!open) setDetailUserId(null); }} />

      {/* Direct message modal */}
      <SendMessageModal
        open={!!messageTarget}
        onOpenChange={(open) => { if (!open) setMessageTarget(null); }}
        targetUser={messageTarget}
      />

      {/* Bulk message modal */}
      <SendMessageModal
        open={bulkMessageOpen}
        onOpenChange={setBulkMessageOpen}
      />
    </AppLayout>
  );
};

export default AdminUsers;
