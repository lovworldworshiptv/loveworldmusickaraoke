import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Crown, Clock, Check, X, Eye, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import UserDetailDialog from "@/components/admin/UserDetailDialog";

interface SubRequest {
  id: string;
  user_id: string;
  full_name: string;
  kingschat_username: string | null;
  plan: string;
  amount: number;
  proof_url: string | null;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  admin_notes: string | null;
  type: "subscription" | "gift";
  gift_message?: string | null;
  recipients?: { recipient_username: string | null; recipient_kc_handle: string | null; recipient_user_id: string | null }[];
}

const PLAN_LABELS: Record<string, string> = {
  "1_month": "1 Month (2 ESP)",
  "6_months": "6 Months (10 ESP)",
  "1_year": "1 Year (15 ESP)",
  "3_day_trial": "3-Day Trial",
};

const PLAN_DAYS: Record<string, number> = {
  "1_month": 30,
  "6_months": 180,
  "1_year": 365,
  "3_day_trial": 3,
};

const AdminSubscriptions = () => {
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [requests, setRequests] = useState<SubRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [detailUserId, setDetailUserId] = useState<string | null>(null);

  const fetchRequests = async () => {
    setLoading(true);

    // Fetch subscription requests
    const { data: subs } = await supabase
      .from("subscription_requests")
      .select("*")
      .order("created_at", { ascending: false });

    // Fetch gift subscriptions
    const { data: gifts } = await supabase
      .from("gift_subscriptions")
      .select("*")
      .order("created_at", { ascending: false });

    const subRows: SubRequest[] = (subs || []).map((s: any) => ({
      ...s,
      type: "subscription" as const,
    }));

    // Fetch recipients for gifts
    const giftIds = (gifts || []).map((g: any) => g.id);
    let recipientMap = new Map<string, any[]>();
    if (giftIds.length > 0) {
      const { data: recipients } = await supabase
        .from("gift_subscription_recipients")
        .select("gift_id, recipient_username, recipient_kc_handle, recipient_user_id")
        .in("gift_id", giftIds);
      (recipients || []).forEach((r: any) => {
        const arr = recipientMap.get(r.gift_id) || [];
        arr.push(r);
        recipientMap.set(r.gift_id, arr);
      });
    }

    const giftRows: SubRequest[] = (gifts || []).map((g: any) => ({
      id: g.id,
      user_id: g.sender_id,
      full_name: g.sender_full_name,
      kingschat_username: g.sender_kc_username,
      plan: g.plan,
      amount: g.amount,
      proof_url: g.proof_url,
      status: g.status,
      created_at: g.created_at,
      reviewed_at: g.reviewed_at,
      admin_notes: g.admin_notes,
      type: "gift" as const,
      gift_message: g.gift_message,
      recipients: recipientMap.get(g.id) || [],
    }));

    const all = [...subRows, ...giftRows].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    setRequests(all);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) fetchRequests();
  }, [isAdmin]);

  const handleApprove = async (req: SubRequest) => {
    setProcessingId(req.id);
    try {
      const days = PLAN_DAYS[req.plan] || 30;
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + days);

      if (req.type === "subscription") {
        // Update the request status
        await supabase
          .from("subscription_requests")
          .update({ status: "approved", reviewed_at: new Date().toISOString() })
          .eq("id", req.id);

        // Activate subscription
        await supabase
          .from("user_subscriptions")
          .update({
            subscription: "premium" as any,
            subscription_plan: req.plan,
            subscription_start_date: new Date().toISOString(),
            subscription_expiry_date: expiry.toISOString(),
          })
          .eq("user_id", req.user_id);
      } else {
        // Gift: approve and activate for each recipient
        await supabase
          .from("gift_subscriptions")
          .update({ status: "approved", reviewed_at: new Date().toISOString() })
          .eq("id", req.id);

        if (req.recipients && req.recipients.length > 0) {
          for (const r of req.recipients) {
            if (r.recipient_user_id) {
              await supabase
                .from("user_subscriptions")
                .update({
                  subscription: "premium" as any,
                  subscription_plan: req.plan,
                  subscription_start_date: new Date().toISOString(),
                  subscription_expiry_date: expiry.toISOString(),
                })
                .eq("user_id", r.recipient_user_id);
            }
          }
        }
      }

      toast.success("Subscription approved and activated");
      setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: "approved", reviewed_at: new Date().toISOString() } : r));
    } catch (err: any) {
      toast.error(err.message || "Failed to approve");
    }
    setProcessingId(null);
  };

  const handleReject = async (req: SubRequest) => {
    setProcessingId(req.id);
    try {
      if (req.type === "subscription") {
        await supabase
          .from("subscription_requests")
          .update({ status: "rejected", reviewed_at: new Date().toISOString() })
          .eq("id", req.id);
      } else {
        await supabase
          .from("gift_subscriptions")
          .update({ status: "rejected", reviewed_at: new Date().toISOString() })
          .eq("id", req.id);
      }
      toast.success("Request rejected");
      setRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: "rejected", reviewed_at: new Date().toISOString() } : r));
    } catch (err: any) {
      toast.error(err.message || "Failed to reject");
    }
    setProcessingId(null);
  };

  if (adminLoading) return <AppLayout><div className="p-6 text-center text-muted-foreground">Loading...</div></AppLayout>;
  if (!isAdmin) return <AppLayout><div className="p-6 text-center text-muted-foreground">Admin access required.</div></AppLayout>;

  const pending = requests.filter(r => r.status === "pending");
  const approved = requests.filter(r => r.status === "approved");
  const rejected = requests.filter(r => r.status === "rejected");

  const renderTable = (items: SubRequest[], showActions: boolean) => (
    <div className="glass-card overflow-hidden">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No requests</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Proof</TableHead>
              <TableHead>Date</TableHead>
              {showActions && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(req => (
              <TableRow key={req.id} className="cursor-pointer" onClick={() => setDetailUserId(req.user_id)}>
                <TableCell>
                  <div>
                    <p className="text-sm font-medium text-foreground">{req.full_name}</p>
                    {req.kingschat_username && (
                      <p className="text-xs text-muted-foreground">@{req.kingschat_username}</p>
                    )}
                    {req.type === "gift" && req.recipients && req.recipients.length > 0 && (
                      <p className="text-xs text-gold mt-0.5">
                        → {req.recipients.map(r => r.recipient_username).join(", ")}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={req.type === "gift" ? "secondary" : "outline"} className="text-xs">
                    {req.type === "gift" ? (
                      <span className="flex items-center gap-1"><Gift className="w-3 h-3" /> Gift</span>
                    ) : "Personal"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-foreground">{PLAN_LABELS[req.plan] || req.plan}</span>
                </TableCell>
                <TableCell>
                  <span className="text-sm font-medium text-gold">{req.amount} ESP</span>
                </TableCell>
                <TableCell>
                  {req.proof_url ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setProofUrl(req.proof_url)}
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" /> View
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">None</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className="text-xs text-muted-foreground">
                    {new Date(req.created_at).toLocaleDateString()}
                  </span>
                </TableCell>
                {showActions && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        disabled={processingId === req.id}
                        onClick={() => handleApprove(req)}
                      >
                        <Check className="w-3.5 h-3.5 mr-1" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 text-xs"
                        disabled={processingId === req.id}
                        onClick={() => handleReject(req)}
                      >
                        <X className="w-3.5 h-3.5 mr-1" /> Reject
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 lg:pt-6 max-w-5xl pb-20">
        <div className="flex items-center gap-3 mb-6">
          <Crown className="w-6 h-6 text-gold" />
          <h2 className="text-2xl font-serif font-bold text-foreground">Pending Subscriptions</h2>
        </div>

        <Tabs defaultValue="awaiting" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="awaiting" className="text-sm">
              Awaiting Approval {pending.length > 0 && (
                <Badge variant="destructive" className="ml-2 h-5 min-w-[20px] text-xs">{pending.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved" className="text-sm">
              Approved {approved.length > 0 && (
                <Badge className="ml-2 h-5 min-w-[20px] text-xs bg-green-600">{approved.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="rejected" className="text-sm">
              Rejected
            </TabsTrigger>
          </TabsList>

          <TabsContent value="awaiting">
            {loading ? <p className="text-muted-foreground text-sm text-center py-12">Loading...</p> : renderTable(pending, true)}
          </TabsContent>
          <TabsContent value="approved">
            {loading ? <p className="text-muted-foreground text-sm text-center py-12">Loading...</p> : renderTable(approved, false)}
          </TabsContent>
          <TabsContent value="rejected">
            {loading ? <p className="text-muted-foreground text-sm text-center py-12">Loading...</p> : renderTable(rejected, false)}
          </TabsContent>
        </Tabs>
      </div>

      {/* Proof Image Viewer */}
      <Dialog open={!!proofUrl} onOpenChange={() => setProofUrl(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Payment Proof</DialogTitle>
          </DialogHeader>
          {proofUrl && (
            <img src={proofUrl} alt="Payment proof" className="w-full rounded-lg" />
          )}
        </DialogContent>
      </Dialog>

      <UserDetailDialog
        userId={detailUserId}
        open={!!detailUserId}
        onOpenChange={(open) => { if (!open) setDetailUserId(null); }}
      />
    </AppLayout>
  );
};

export default AdminSubscriptions;
