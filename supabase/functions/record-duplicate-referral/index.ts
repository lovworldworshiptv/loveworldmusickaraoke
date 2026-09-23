import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Called when a user opens a referral link but is already enrolled in the
// challenge. Logs a non-counting referral so the referrer is told the invite
// is already in the challenge and gets no points for it.
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

    const { challenge_id, ref } = await req.json();
    if (!challenge_id || !ref) return json({ error: "challenge_id and ref required" }, 400);

    const raw = String(ref).trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw);
    let refId: string | null = isUuid ? raw : null;
    if (!refId) {
      const { data: prof } = await svc.from("profiles").select("user_id").ilike("username", raw).maybeSingle();
      refId = prof?.user_id ?? null;
    }
    if (!refId || refId === user.id) return json({ skipped: "invalid_referrer" });

    const { data: entry } = await svc.from("challenge_entries").select("id")
      .eq("challenge_id", challenge_id).eq("user_id", user.id).maybeSingle();
    if (!entry) return json({ skipped: "not_enrolled" });

    const { data: existing } = await svc.from("challenge_referrals").select("id, awarded")
      .eq("challenge_id", challenge_id).eq("referred_user_id", user.id).maybeSingle();
    if (existing) return json({ skipped: "already_recorded", awarded: existing.awarded });

    await svc.from("challenge_referrals").insert({
      challenge_id, referrer_user_id: refId, referred_user_id: user.id, awarded: false,
    });
    return json({ success: true, duplicate: true });
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
