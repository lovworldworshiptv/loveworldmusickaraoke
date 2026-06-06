import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const svc = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let body: any = {};
    try { body = await req.json(); } catch {}
    const { challenge_id } = body;

    // Caller authz: admin OR no challenge_id (cron call from pg_cron via anon header allowed)
    const authHeader = req.headers.get("Authorization");
    let isAdmin = false;
    if (authHeader && challenge_id) {
      const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
        const { data } = await svc.rpc("has_role", { _user_id: user.id, _role: "admin" });
        isAdmin = !!data;
      }
      if (!isAdmin) return json({ error: "Not authorized" }, 403);
    }

    const query = svc.from("challenges").select("*").eq("status", "active");
    const { data: list } = challenge_id ? await query.eq("id", challenge_id) : await query.lte("end_date", new Date().toISOString());

    const results: any[] = [];
    for (const ch of (list || [])) {
      if (!challenge_id && new Date(ch.end_date) > new Date()) continue;
      const { data: scores } = await svc.from("challenge_scores")
        .select("user_id, total_score, qualified")
        .eq("challenge_id", ch.id).eq("qualified", true)
        .order("total_score", { ascending: false });
      const dist = ch.prize_distribution as Record<string, number>;
      const ranks = Object.keys(dist).map(Number).sort((a, b) => a - b);
      for (let i = 0; i < (scores || []).length; i++) {
        const rank = i + 1;
        const prize = dist[String(rank)] ?? 0;
        await svc.from("challenge_scores").update({
          final_rank: rank, prize_awarded: prize,
        }).eq("challenge_id", ch.id).eq("user_id", scores![i].user_id);
        if (prize > 0) {
          // credit espees
          const { data: prof } = await svc.from("profiles").select("espees_balance").eq("user_id", scores![i].user_id).maybeSingle();
          const current = Number(prof?.espees_balance || 0);
          await svc.from("profiles").update({ espees_balance: current + prize }).eq("user_id", scores![i].user_id);
        }
      }
      await svc.from("challenges").update({ status: "completed" }).eq("id", ch.id);
      results.push({ challenge_id: ch.id, finalized: true, winners: (scores || []).slice(0, ranks.length) });
    }
    return json({ success: true, results });
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
