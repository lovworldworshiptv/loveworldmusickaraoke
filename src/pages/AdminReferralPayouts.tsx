import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";

const AdminReferralPayouts = () => {
  const { isAdmin, loading } = useIsAdmin() as any;
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({
    queryKey: ["admin-referral-payouts"],
    enabled: !!isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("referral_payouts").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      const ids = [...new Set((data || []).map((r) => r.user_id))];
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("user_id, username").in("user_id", ids)
        : { data: [] as any[] };
      const names = new Map((profs || []).map((p: any) => [p.user_id, p.username]));
      return (data || []).map((r) => ({ ...r, username: names.get(r.user_id) || "Unknown" }));
    },
  });

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;

  const review = async (id: string, status: "paid" | "rejected") => {
    const { error } = await supabase.rpc("review_referral_payout", { p_id: id, p_status: status, p_notes: null });
    if (error) return toast.error(error.message);
    toast.success(status === "paid" ? "Marked as paid" : "Rejected and refunded");
    qc.invalidateQueries({ queryKey: ["admin-referral-payouts"] });
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-foreground mb-4">Referral Payouts</h1>
        {rows.length === 0 ? <p className="text-muted-foreground">No payout requests yet.</p> : (
          <div className="space-y-2">
            {rows.map((r: any) => (
              <div key={r.id} className="glass-card rounded-2xl p-4 flex flex-wrap items-center gap-3 justify-between">
                <div>
                  <p className="font-semibold text-foreground">{r.username} — {Number(r.amount).toFixed(2)} ESP</p>
                  <p className="text-xs text-muted-foreground">KingsChat: {r.kingschat_username || "—"} · {new Date(r.created_at).toLocaleString()} · <span className="capitalize">{r.status}</span></p>
                </div>
                {r.status === "pending" && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => review(r.id, "paid")}>Mark paid</Button>
                    <Button size="sm" variant="outline" onClick={() => review(r.id, "rejected")}>Reject</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default AdminReferralPayouts;
