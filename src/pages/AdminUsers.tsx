import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Users, Shield, Crown, User, Search, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface UserRow {
  user_id: string;
  username: string;
  avatar_url: string | null;
  email?: string;
  role: string;
  created_at: string;
}

const AdminUsers = () => {
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    // Get profiles + roles
    const { data: profiles, error: pErr } = await supabase
      .from("profiles")
      .select("user_id, username, avatar_url, created_at")
      .order("created_at", { ascending: false });

    if (pErr || !profiles) {
      toast.error("Failed to load users");
      setLoading(false);
      return;
    }

    // Get all roles
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role");

    const roleMap = new Map<string, string>();
    (roles || []).forEach((r: any) => roleMap.set(r.user_id, r.role));

    const merged: UserRow[] = profiles.map((p: any) => ({
      user_id: p.user_id,
      username: p.username,
      avatar_url: p.avatar_url,
      role: roleMap.get(p.user_id) || "free",
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
    // Upsert role
    const { error } = await supabase
      .from("user_roles")
      .upsert({ user_id: userId, role: newRole as any }, { onConflict: "user_id,role" });

    if (error) {
      // If unique conflict, update instead
      const { error: updateErr } = await supabase
        .from("user_roles")
        .update({ role: newRole as any })
        .eq("user_id", userId);
      if (updateErr) {
        toast.error("Failed to update role");
        setUpdatingId(null);
        return;
      }
    }

    toast.success("Role updated");
    setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, role: newRole } : u));
    setUpdatingId(null);
  };

  const handleDeleteUser = async (userId: string) => {
    const { error } = await supabase.functions.invoke("delete-account", {
      body: { targetUserId: userId },
    });
    if (error) {
      toast.error("Failed to delete user");
      return;
    }
    toast.success("User deleted");
    setUsers(prev => prev.filter(u => u.user_id !== userId));
  };

  const roleIcon = (role: string) => {
    if (role === "admin") return <Shield className="w-3.5 h-3.5 text-destructive" />;
    if (role === "premium") return <Crown className="w-3.5 h-3.5 text-gold" />;
    if (role === "editor") return <Shield className="w-3.5 h-3.5 text-primary" />;
    return <User className="w-3.5 h-3.5 text-muted-foreground" />;
  };

  if (adminLoading) return <AppLayout><div className="p-6 text-center text-muted-foreground">Loading...</div></AppLayout>;
  if (!isAdmin) return <AppLayout><div className="p-6 text-center text-muted-foreground">Admin access required.</div></AppLayout>;

  const filtered = users.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.user_id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 lg:pt-6 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-gold" />
            <h2 className="text-2xl font-serif font-bold text-foreground">Manage Users</h2>
          </div>
          <span className="text-sm text-muted-foreground">{users.length} users</span>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text" placeholder="Search by username..."
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
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(user => (
                  <TableRow key={user.user_id}>
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
                          <p className="text-[10px] text-muted-foreground font-mono">{user.user_id.slice(0, 8)}…</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={user.role}
                        onValueChange={(v) => handleRoleChange(user.user_id, v)}
                        disabled={updatingId === user.user_id}
                      >
                        <SelectTrigger className="w-[120px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="free">
                            <span className="flex items-center gap-1.5"><User className="w-3 h-3" /> Free</span>
                          </SelectItem>
                          <SelectItem value="premium">
                            <span className="flex items-center gap-1.5"><Crown className="w-3 h-3 text-gold" /> Premium</span>
                          </SelectItem>
                          <SelectItem value="editor">
                            <span className="flex items-center gap-1.5"><Shield className="w-3 h-3 text-primary" /> Editor</span>
                          </SelectItem>
                          <SelectItem value="admin">
                            <span className="flex items-center gap-1.5"><Shield className="w-3 h-3 text-destructive" /> Admin</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Delete user">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete user "{user.username}"?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete this user and all their data. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteUser(user.user_id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
      <div className="h-8" />
    </AppLayout>
  );
};

export default AdminUsers;
