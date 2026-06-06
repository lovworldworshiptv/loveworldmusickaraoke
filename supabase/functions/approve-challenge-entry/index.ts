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
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Invalid token" }, 401);

    const { data: isAdmin } = await svc.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Not authorized" }, 403);

    const { entry_id, action, notes } = await req.json();
    if (!entry_id || !["approve", "reject"].includes(action)) return json({ error: "Invalid input" }, 400);

    const { data: entry, error: eerr } = await svc.from("challenge_entries")
      .select("*").eq("id", entry_id).single();
    if (eerr || !entry) return json({ error: "Entry not found" }, 404);

    const newStatus = action === "approve" ? "approved" : "rejected";
    const { error: uerr } = await svc.from("challenge_entries").update({
      status: newStatus, admin_notes: notes ?? null, approved_by: user.id, approved_at: new Date().toISOString(),
    }).eq("id", entry_id);
    if (uerr) throw uerr;

    if (action === "approve") {
      await svc.from("challenge_scores").upsert(
        { challenge_id: entry.challenge_id, user_id: entry.user_id },
        { onConflict: "challenge_id,user_id" }
      );
      if (entry.referred_by_user_id && entry.referred_by_user_id !== entry.user_id) {
        const { data: ch } = await svc.from("challenges").select("max_referrals_per_user").eq("id", entry.challenge_id).single();
        await awardReferral(svc, entry.challenge_id, entry.referred_by_user_id, entry.user_id, ch?.max_referrals_per_user);
      }
    }
    return json({ success: true });
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
});

async function awardReferral(svc: any, challenge_id: string, referrer: string, referred: string, cap: number | null) {
  const { data: existing } = await svc.from("challenge_referrals")
    .select("id, awarded").eq("challenge_id", challenge_id).eq("referred_user_id", referred).maybeSingle();
  if (existing?.awarded) return;
  if (cap && cap > 0) {
    const { count } = await svc.from("challenge_referrals")
      .select("id", { count: "exact", head: true })
      .eq("challenge_id", challenge_id).eq("referrer_user_id", referrer).eq("awarded", true);
    if ((count ?? 0) >= cap) return;
  }
  if (existing) {
    await svc.from("challenge_referrals").update({ awarded: true }).eq("id", existing.id);
  } else {
    await svc.from("challenge_referrals").insert({ challenge_id, referrer_user_id: referrer, referred_user_id: referred, awarded: true });
  }
  await svc.from("challenge_bonuses_awarded").upsert({
    challenge_id, user_id: referrer, bonus_key: `referral_${referred}`, points: 50,
  }, { onConflict: "challenge_id,user_id,bonus_key" });
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
