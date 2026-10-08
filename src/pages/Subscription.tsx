import { useFeatures } from "@/contexts/FeatureContext";
import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useIsPremium } from "@/hooks/useIsPremium";
import { supabase } from "@/integrations/supabase/client";
import { Crown, Gift, Clock, Check, Upload, Camera, Search, X, ChevronRight, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

const PLANS = [
  { id: "3_day_trial", label: "Try Premium", duration: "3 Days Free Trial", amount: 0, espees: "Free" },
  { id: "1_month", label: "1 Month", duration: "30 Days", amount: 2, espees: "2 ESP" },
  { id: "6_months", label: "6 Months", duration: "180 Days", amount: 10, espees: "10 ESP" },
  { id: "1_year", label: "1 Year", duration: "365 Days", amount: 15, espees: "15 ESP" },
];

const GIFT_PLANS = PLANS.filter(p => p.id !== "3_day_trial");

const Subscription = () => {
  const { user, username, kingschatHandle } = useAuth();
  const { isPremium, isTrial, subscriptionExpiry } = useIsPremium();
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [showGiftForm, setShowGiftForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successDialog, setSuccessDialog] = useState<string | null>(null);

  // Subscribe form state
  const [subFullName, setSubFullName] = useState("");
  const [subKcUsername, setSubKcUsername] = useState(kingschatHandle || "");
  const [proofFile, setProofFile] = useState<File | null>(null);

  // Gift form state
  const [giftPlan, setGiftPlan] = useState("");
  const [giftMessage, setGiftMessage] = useState("");
  const [giftFullName, setGiftFullName] = useState("");
  const [giftKcUsername, setGiftKcUsername] = useState(kingschatHandle || "");
  const [giftProofFile, setGiftProofFile] = useState<File | null>(null);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [recipientResults, setRecipientResults] = useState<any[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const chosenPlan = PLANS.find(p => p.id === selectedPlan);
  const [creditBalance, setCreditBalance] = useState(0);
  useEffect(() => {
    if (!user) return;
    supabase.from("referral_ledger").select("amount").eq("user_id", user.id)
      .then(({ data }) => setCreditBalance((data || []).reduce((s, r: any) => s + Number(r.amount), 0)));
  }, [user, successDialog]);
  const referralsOn = useFeatures().enabled("referrals");
  const creditApplied = referralsOn && chosenPlan && chosenPlan.amount > 0 ? Math.min(Math.max(creditBalance, 0), chosenPlan.amount) : 0;
  const amountDue = chosenPlan ? Math.max(chosenPlan.amount - creditApplied, 0) : 0;
  const chosenGiftPlan = GIFT_PLANS.find(p => p.id === giftPlan);
  const giftTotalAmount = chosenGiftPlan ? chosenGiftPlan.amount * Math.max(selectedRecipients.length, 1) : 0;

  useEffect(() => {
    setSubKcUsername(kingschatHandle || "");
    setGiftKcUsername(kingschatHandle || "");
  }, [kingschatHandle]);

  const searchRecipients = async (query: string) => {
    setRecipientSearch(query);
    if (query.length < 2) { setRecipientResults([]); return; }
    setSearching(true);
    try {
      const { data } = await supabase.from("profiles")
        .select("user_id, username, kingschat_handle, avatar_url, email")
        .or(`username.ilike.%${query}%,kingschat_handle.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(10);
      setRecipientResults((data || []).filter(r => r.user_id !== user?.id && !selectedRecipients.some(s => s.user_id === r.user_id)));
    } catch { setRecipientResults([]); }
    setSearching(false);
  };

  const addRecipient = (r: any) => {
    setSelectedRecipients(prev => [...prev, r]);
    setRecipientSearch("");
    setRecipientResults([]);
  };

  const removeRecipient = (userId: string) => {
    setSelectedRecipients(prev => prev.filter(r => r.user_id !== userId));
  };

  const uploadProof = async (file: File): Promise<string> => {
    const ext = file.name.split(".").pop();
    const path = `${user!.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("payment-proofs").upload(path, file);
    if (error) throw new Error("Failed to upload proof: " + error.message);
    const { data: { publicUrl } } = supabase.storage.from("payment-proofs").getPublicUrl(path);
    return publicUrl;
  };

  const handleSubscribe = async () => {
    if (!selectedPlan || !user) return;

    // Trial: activate directly without name/proof
    if (selectedPlan === "3_day_trial") {
      setSubmitting(true);
      try {
        const { data, error } = await supabase.functions.invoke("activate-trial");
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        setSuccessDialog("trial");
        setSelectedPlan(null);
      } catch (err: any) {
        toast.error(err.message || "Failed to activate trial");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (amountDue > 0 && !proofFile) { toast.error("Please upload proof of payment"); return; }
    if (!subFullName.trim()) { toast.error("Please enter your full name"); return; }

    setSubmitting(true);
    try {
      let proofUrl = "";
      if (proofFile) proofUrl = await uploadProof(proofFile);

      const { error } = await supabase.rpc("request_subscription_with_credit", {
        p_plan: selectedPlan,
        p_full_name: subFullName.trim(),
        p_kingschat: subKcUsername.trim() || null,
        p_proof_url: proofUrl || null,
      });
      if (error) throw error;

      // Notify admins
      supabase.functions.invoke("notify-admin-payment", {
        body: { type: "subscription", plan: selectedPlan, amount: chosenPlan?.amount || 0, username: username || "Unknown" },
      }).catch(() => {});

      setSuccessDialog("subscribe");
      setSelectedPlan(null);
      setSubFullName("");
      setProofFile(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGiftSubmit = async () => {
    if (!giftPlan || !user || selectedRecipients.length === 0) return;
    if (!giftProofFile) { toast.error("Please upload proof of payment"); return; }
    if (!giftFullName.trim()) { toast.error("Please enter your full name"); return; }

    setSubmitting(true);
    try {
      const proofUrl = await uploadProof(giftProofFile);

      const { data: gift, error } = await supabase.from("gift_subscriptions").insert({
        sender_id: user.id,
        sender_full_name: giftFullName.trim(),
        sender_kc_username: giftKcUsername.trim() || null,
        plan: giftPlan,
        amount: giftTotalAmount,
        gift_message: giftMessage.trim() || null,
        proof_url: proofUrl,
      }).select("id").single();
      if (error) throw error;

      // Insert recipients
      const recipients = selectedRecipients.map(r => ({
        gift_id: gift.id,
        recipient_username: r.username,
        recipient_kc_handle: r.kingschat_handle || null,
        recipient_user_id: r.user_id,
      }));
      await supabase.from("gift_subscription_recipients").insert(recipients);

      // Notify admins
      supabase.functions.invoke("notify-admin-payment", {
        body: { type: "gift", plan: giftPlan, amount: giftTotalAmount, username: username || "Unknown" },
      }).catch(() => {});

      setSuccessDialog("gift");
      setShowGiftForm(false);
      setSelectedRecipients([]);
      setGiftFullName("");
      setGiftProofFile(null);
      setGiftMessage("");
      setGiftPlan("");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit gift");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 lg:pt-6 max-w-lg mx-auto pb-20">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-full bg-gold/20 flex items-center justify-center mx-auto mb-3">
            <Crown className="w-8 h-8 text-gold" />
          </div>
          <h1 className="text-2xl font-serif font-bold text-foreground">Premium Subscription</h1>
          <p className="text-sm text-muted-foreground mt-1">Unlock offline playback, karaoke mode & more</p>
          {isPremium && (
            <div className="mt-3 space-y-2">
              <p className="text-sm font-bold text-gold uppercase tracking-wide">
                YOU ARE CURRENTLY A {isTrial ? "TRIAL" : "PREMIUM"} USER
              </p>
              {subscriptionExpiry && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gold/20 text-gold text-xs font-semibold">
                  <Check className="w-3.5 h-3.5" /> Active until {new Date(subscriptionExpiry).toLocaleDateString()}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Plans */}
        <div className="space-y-3 mb-6">
          {PLANS.map((plan) => (
            <button
              key={plan.id}
              onClick={() => { setSelectedPlan(plan.id); setShowGiftForm(false); }}
              className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
                selectedPlan === plan.id
                  ? "border-gold bg-gold/10 ring-1 ring-gold"
                  : "border-border bg-card hover:border-gold/50"
              }`}
            >
              <div className="text-left">
                <p className="font-semibold text-foreground">{plan.label}</p>
                <p className="text-xs text-muted-foreground">{plan.duration}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-gold text-lg">{plan.espees}</p>
                {plan.id === "3_day_trial" && <p className="text-[10px] text-muted-foreground">No payment needed</p>}
              </div>
            </button>
          ))}
        </div>

        {/* Gift Button */}
        <button
          onClick={() => { setShowGiftForm(true); setSelectedPlan(null); }}
          className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all mb-6 ${
            showGiftForm ? "border-gold bg-gold/10 ring-1 ring-gold" : "border-border bg-card hover:border-gold/50"
          }`}
        >
          <div className="flex items-center gap-3">
            <Gift className="w-5 h-5 text-gold" />
            <div className="text-left">
              <p className="font-semibold text-foreground">Gift a Subscription</p>
              <p className="text-xs text-muted-foreground">Sponsor others for Premium access</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>

        {/* Subscribe Plan Dialog */}
        <Dialog open={!!selectedPlan} onOpenChange={(open) => { if (!open) setSelectedPlan(null); }}>
          <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg font-serif">
                {chosenPlan?.label} — {chosenPlan?.espees}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {selectedPlan === "3_day_trial" ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Enjoy all premium features free for 3 days. No payment required. Your subscription will automatically revert to free after the trial period.
                  </p>
                  <Button
                    onClick={handleSubscribe}
                    disabled={submitting}
                    className="w-full gradient-gold text-primary-foreground font-semibold"
                  >
                    {submitting ? "Activating..." : "Activate"}
                  </Button>
                </>
              ) : (
                <>
                  <div className="bg-muted/50 rounded-xl p-4 text-sm space-y-2">
                    <p className="font-semibold text-foreground">Payment Details</p>
                    <div className="space-y-1 text-muted-foreground">
                      <p><span className="font-medium text-foreground">Espees Username:</span> @loveworldmusic.org</p>
                      <p><span className="font-medium text-foreground">Wallet address:</span> <span className="break-all">0x39576aec39d7f73bfa8f64f0bfa5a8e930921c34</span></p>
                      <p className="font-semibold text-foreground mt-2">Bank Transfer:</p>
                      <p><span className="font-medium text-foreground">Account No:</span> 1000316347</p>
                      <p><span className="font-medium text-foreground">Account Name:</span> LMAM - Music App</p>
                      <p><span className="font-medium text-foreground">Bank:</span> Parallex Bank</p>
                    </div>
                  </div>

                  <Input placeholder="Full Name *" value={subFullName} onChange={e => setSubFullName(e.target.value)} />
                  <Input placeholder="KingsChat Username" value={subKcUsername} onChange={e => setSubKcUsername(e.target.value)} />
                  <Input
                    placeholder={`Amount: ${chosenPlan?.amount || 0} ESP`}
                    value={`${chosenPlan?.amount || 0} ESP`}
                    disabled
                    className="bg-muted"
                  />
                  {creditApplied > 0 && (
                    <div className="rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm text-foreground">
                      Referral balance applied: <b>{creditApplied.toFixed(2)} ESP</b> · Amount to pay: <b>{amountDue.toFixed(2)} ESP</b>
                      {amountDue === 0 && <p className="text-xs text-muted-foreground mt-1">Fully covered by your referral balance — no proof needed.</p>}
                    </div>
                  )}

                  <div className={amountDue === 0 ? "hidden" : ""}>
                    <label className="text-sm font-medium text-foreground mb-1 block">Proof of Transaction *</label>
                    {proofFile && (
                      <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg mb-2">
                        <Check className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-foreground truncate flex-1">{proofFile.name}</span>
                        <button onClick={() => setProofFile(null)} className="text-muted-foreground hover:text-destructive"><X className="w-4 h-4" /></button>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <label className="flex-1 flex items-center justify-center gap-2 p-3 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-gold/50 transition-colors">
                        <Upload className="w-5 h-5 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Select Image</span>
                        <input type="file" accept="image/*" className="hidden" onChange={e => setProofFile(e.target.files?.[0] || null)} />
                      </label>
                      <label className="flex-1 flex items-center justify-center gap-2 p-3 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-gold/50 transition-colors">
                        <Camera className="w-5 h-5 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Take Photo</span>
                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => setProofFile(e.target.files?.[0] || null)} />
                      </label>
                    </div>
                  </div>

                  <Button
                    onClick={handleSubscribe}
                    disabled={submitting}
                    className="w-full gradient-gold text-primary-foreground font-semibold"
                  >
                    {submitting ? "Submitting..." : "Submit Payment"}
                  </Button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Gift Subscription Dialog */}
        <Dialog open={showGiftForm} onOpenChange={setShowGiftForm}>
          <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg font-serif flex items-center gap-2">
                <Gift className="w-5 h-5 text-gold" /> Gift a Subscription
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Recipient Search */}
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Search Recipients *</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by username, email or KC handle"
                    value={recipientSearch}
                    onChange={e => searchRecipients(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {recipientResults.length > 0 && (
                  <div className="mt-1 border border-border rounded-lg bg-card max-h-40 overflow-y-auto">
                    {recipientResults.map(r => (
                      <button key={r.user_id} onClick={() => addRecipient(r)} className="w-full flex items-center gap-2 p-2 hover:bg-muted/60 text-left text-sm">
                        <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                          {r.username?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{r.username}</p>
                          {r.kingschat_handle && <p className="text-xs text-muted-foreground">@{r.kingschat_handle}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {searching && <p className="text-xs text-muted-foreground mt-1">Searching...</p>}
              </div>

              {/* Selected Recipients */}
              {selectedRecipients.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedRecipients.map(r => (
                    <span key={r.user_id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gold/20 text-gold text-xs font-medium">
                      {r.username}
                      <button onClick={() => removeRecipient(r.user_id)}><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>
              )}

              {/* Payment Details */}
              <div className="bg-muted/50 rounded-xl p-4 text-sm space-y-2">
                <p className="font-semibold text-foreground">Payment Details</p>
                <div className="space-y-1 text-muted-foreground">
                  <p><span className="font-medium text-foreground">Espees Merchant Code:</span> LMM01</p>
                  <p className="font-semibold text-foreground mt-2">Bank Transfer:</p>
                  <p><span className="font-medium text-foreground">Account No:</span> 1000316347</p>
                  <p><span className="font-medium text-foreground">Account Name:</span> LMAM - Music App</p>
                  <p><span className="font-medium text-foreground">Bank:</span> Parallex Bank</p>
                </div>
              </div>

              <Input placeholder="Your Full Name *" value={giftFullName} onChange={e => setGiftFullName(e.target.value)} />
              <Input placeholder="Your KC Username (Espees sender account)" value={giftKcUsername} onChange={e => setGiftKcUsername(e.target.value)} />

              <Select value={giftPlan} onValueChange={setGiftPlan}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Plan" />
                </SelectTrigger>
                <SelectContent>
                  {GIFT_PLANS.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.label} — {p.espees}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                placeholder="Total Amount"
                value={giftTotalAmount > 0 ? `${giftTotalAmount} ESP (${selectedRecipients.length} recipient${selectedRecipients.length !== 1 ? "s" : ""} × ${chosenGiftPlan?.amount || 0} ESP)` : ""}
                disabled
                className="bg-muted"
              />

              <Textarea placeholder="Gift message (optional)" value={giftMessage} onChange={e => setGiftMessage(e.target.value)} rows={2} />

              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Proof of Transaction *</label>
                {giftProofFile && (
                  <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg mb-2">
                    <Check className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-foreground truncate flex-1">{giftProofFile.name}</span>
                    <button onClick={() => setGiftProofFile(null)} className="text-muted-foreground hover:text-destructive"><X className="w-4 h-4" /></button>
                  </div>
                )}
                <div className="flex gap-2">
                  <label className="flex-1 flex items-center justify-center gap-2 p-3 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-gold/50 transition-colors">
                    <Upload className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Select Image</span>
                    <input type="file" accept="image/*" className="hidden" onChange={e => setGiftProofFile(e.target.files?.[0] || null)} />
                  </label>
                  <label className="flex-1 flex items-center justify-center gap-2 p-3 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-gold/50 transition-colors">
                    <Camera className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Take Photo</span>
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => setGiftProofFile(e.target.files?.[0] || null)} />
                  </label>
                </div>
              </div>

              <Button
                onClick={handleGiftSubmit}
                disabled={submitting || selectedRecipients.length === 0 || !giftPlan}
                className="w-full gradient-gold text-primary-foreground font-semibold"
              >
                {submitting ? "Submitting..." : "Send Gift"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Success Dialog */}
        <Dialog open={!!successDialog} onOpenChange={() => { setSuccessDialog(null); navigate("/"); }}>
          <DialogContent className="max-w-sm text-center">
            <DialogHeader>
              <DialogTitle className="text-lg font-serif">
                {successDialog === "trial" ? "Premium Trial Activated" : "Subscription Pending"}
              </DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-3">
              <div className="w-14 h-14 rounded-full bg-gold/20 flex items-center justify-center mx-auto">
                {successDialog === "trial"
                  ? <Sparkles className="w-7 h-7 text-gold" />
                  : <Clock className="w-7 h-7 text-gold" />
                }
              </div>
              {successDialog === "trial" ? (
                <p className="text-sm text-muted-foreground">
                  Thank you for your subscription. Enjoy all premium features for the next 3 days!
                </p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Thank you for your submission. {successDialog === "gift" ? "Gift subscription" : "Your subscription"} is currently pending approval.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {successDialog === "gift"
                      ? "Recipients will be notified via KingsChat or email once the subscription is active."
                      : "You will be notified via KingsChat or email once your subscription is active."}
                  </p>
                </>
              )}
              <Button onClick={() => { setSuccessDialog(null); navigate("/"); }} className="w-full gradient-gold text-primary-foreground">
                Got it
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default Subscription;
