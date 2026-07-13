import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Not authenticated" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const svc = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: uerr } = await userClient.auth.getUser();
    if (uerr || !user) return json({ error: "Invalid token" }, 401);

    const { challenge_id, payment_proof_url, referred_by_user_id, full_name, kingschat_username, zone } = await req.json();
    if (!challenge_id) return json({ error: "challenge_id required" }, 400);

    const { data: ch, error: cerr } = await svc.from("challenges").select("*").eq("id", challenge_id).single();
    if (cerr || !ch) return json({ error: "Challenge not found" }, 404);
    if (ch.status !== "active") return json({ error: "Challenge is not active" }, 400);
    if (new Date(ch.end_date) < new Date()) return json({ error: "Challenge has ended" }, 400);

    // Check subscription
    const { data: sub } = await svc.from("user_subscriptions")
      .select("subscription, subscription_expiry_date").eq("user_id", user.id).maybeSingle();
    const expired = sub?.subscription_expiry_date && new Date(sub.subscription_expiry_date) < new Date();
    const effectiveTier = expired ? "free" : (sub?.subscription || "free");
    const isPremium = effectiveTier === "premium" || effectiveTier === "trial";
    const isFree = Number(ch.entry_fee) <= 0;

    // Tier gating
    const allowed: string[] = Array.isArray((ch as any).allowed_subscriptions) && (ch as any).allowed_subscriptions.length
      ? (ch as any).allowed_subscriptions
      : ["free", "trial", "premium"];
    if (!allowed.includes(effectiveTier)) {
      return json({ error: `This challenge is only open to: ${allowed.join(", ")} subscribers.` }, 403);
    }

    if (!isPremium && !isFree && (!zone || !String(zone).trim())) {
      return json({ error: "Zone is required" }, 400);
    }

    // Existing entry?
    const { data: existing } = await svc.from("challenge_entries")
      .select("id, status").eq("challenge_id", challenge_id).eq("user_id", user.id).maybeSingle();
    if (existing) return json({ error: "You already have an entry", entry: existing }, 400);

    // Resolve referrer: accept a UUID or a username. Reject self-referrals.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let validReferrer: string | null = null;
    if (referred_by_user_id && typeof referred_by_user_id === "string") {
      const raw = referred_by_user_id.trim();
      if (UUID_RE.test(raw)) {
        validReferrer = raw;
      } else {
        const { data: prof } = await svc.from("profiles").select("user_id").ilike("username", raw).maybeSingle();
        if (prof?.user_id) validReferrer = prof.user_id;
      }
      if (validReferrer === user.id) validReferrer = null;
    }

    const autoApprove = isPremium || isFree;
    const status = autoApprove ? "approved" : "pending";
    const paid_amount = autoApprove ? 0 : Number(ch.entry_fee);

    const { data: entry, error: ierr } = await svc.from("challenge_entries").insert({
      challenge_id, user_id: user.id, status, paid_amount,
      is_premium_free: autoApprove, payment_proof_url: payment_proof_url ?? null,
      referred_by_user_id: validReferrer,
      full_name: full_name ?? null,
      kingschat_username: kingschat_username ?? null,
      zone: zone ?? null,
      approved_by: autoApprove ? user.id : null,
      approved_at: autoApprove ? new Date().toISOString() : null,
    }).select().single();
    if (ierr) throw ierr;

    if (status === "approved") {
      await svc.from("challenge_scores").upsert({ challenge_id, user_id: user.id }, { onConflict: "challenge_id,user_id" });
      if (validReferrer) {
        await awardReferral(svc, challenge_id, validReferrer, user.id, ch.max_referrals_per_user);
      }
    } else {
      // Notify admins of pending entry payment
      try {
        const { data: admins } = await svc.from("user_roles").select("user_id").eq("role", "admin");
        if (admins && admins.length > 0) {
          const title = "New Challenge Entry Submission";
          const message = `${full_name || kingschat_username || "A user"} submitted a Song Master Challenge entry${zone ? ` (Zone: ${zone})` : ""} for "${ch.name}" — ${paid_amount} ESP. Review it now.`;
          const { data: notification } = await svc.from("notifications").insert({
            title, message, segment: "admins", status: "sent",
            sent_at: new Date().toISOString(), created_by: user.id, deep_link: "/admin/challenges",
          }).select("id").single();
          if (notification) {
            await svc.from("user_notifications").insert(
              admins.map((a: any) => ({ user_id: a.user_id, notification_id: notification.id }))
            );
          }
        }
      } catch (e) { console.warn("notify admins failed", e); }
    }

    return json({ success: true, entry });
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
});

async function awardReferral(svc: any, challenge_id: string, referrer: string, referred: string, cap: number | null) {
  const { data: existing } = await svc.from("challenge_referrals")
    .select("id").eq("challenge_id", challenge_id).eq("referred_user_id", referred).maybeSingle();
  if (existing) return;
  if (cap && cap > 0) {
    const { count } = await svc.from("challenge_referrals")
      .select("id", { count: "exact", head: true })
      .eq("challenge_id", challenge_id).eq("referrer_user_id", referrer);
    if ((count ?? 0) >= cap) {
      await svc.from("challenge_referrals").insert({ challenge_id, referrer_user_id: referrer, referred_user_id: referred, awarded: false });
      return;
    }
  }
  await svc.from("challenge_referrals").insert({ challenge_id, referrer_user_id: referrer, referred_user_id: referred, awarded: true });
  await svc.from("challenge_bonuses_awarded").insert({
    challenge_id, user_id: referrer, bonus_key: `referral_${referred}`, points: 50,
  });
  await recalcScore(svc, challenge_id, referrer);
}

async function recalcScore(svc: any, challenge_id: string, user_id: string) {
  const { data: logs } = await svc.from("challenge_game_logs")
    .select("score, counted_toward_score").eq("challenge_id", challenge_id).eq("user_id", user_id);
  const { data: bonuses } = await svc.from("challenge_bonuses_awarded")
    .select("points").eq("challenge_id", challenge_id).eq("user_id", user_id);
  const logTotal = (logs || []).filter((l: any) => l.counted_toward_score).reduce((s: number, l: any) => s + (l.score || 0), 0);
  const bonusTotal = (bonuses || []).reduce((s: number, b: any) => s + (b.points || 0), 0);
  await svc.from("challenge_scores").upsert(
    { challenge_id, user_id, total_score: logTotal + bonusTotal },
    { onConflict: "challenge_id,user_id" }
  );
}

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
