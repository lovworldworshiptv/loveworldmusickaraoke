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

    const { mode, difficulty, score } = await req.json();
    if (!["lyrics", "melody", "category"].includes(mode)) return json({ error: "Invalid mode" }, 400);

    // Find user's active approved challenge
    const nowIso = new Date().toISOString();
    const { data: ch } = await svc.from("challenges").select("*")
      .eq("status", "active").lte("start_date", nowIso).gte("end_date", nowIso)
      .order("start_date", { ascending: false }).limit(1).maybeSingle();
    if (!ch) return json({ skipped: "no_active_challenge" });

    const { data: entry } = await svc.from("challenge_entries").select("status")
      .eq("challenge_id", ch.id).eq("user_id", user.id).maybeSingle();
    if (!entry || entry.status !== "approved") return json({ skipped: "not_enrolled" });

    // Daily cap check
    const todayStart = new Date(); todayStart.setUTCHours(0, 0, 0, 0);
    const { data: todayLogs } = await svc.from("challenge_game_logs")
      .select("id, mode, difficulty, counted_toward_score")
      .eq("challenge_id", ch.id).eq("user_id", user.id)
      .gte("completed_at", todayStart.toISOString());
    const countedToday = (todayLogs || []).filter((l: any) => l.counted_toward_score).length;
    const cap = ch.max_daily_scoring_games;
    const counted = !cap || countedToday < cap;

    await svc.from("challenge_game_logs").insert({
      challenge_id: ch.id, user_id: user.id, mode, difficulty: difficulty ?? null,
      score: Number(score) || 0, counted_toward_score: counted,
    });

    // Award bonuses
    const ymd = todayStart.toISOString().slice(0, 10).replace(/-/g, "");
    const bonuses: { key: string; points: number }[] = [];

    // Daily login (once per day, first game)
    if ((todayLogs || []).length === 0) bonuses.push({ key: `daily_login_${ymd}`, points: 5 });

    const newCount = (todayLogs || []).length + 1;
    if (newCount === 5) bonuses.push({ key: `activity_5_${ymd}`, points: 20 });
    if (newCount === 10) bonuses.push({ key: `activity_10_${ymd}`, points: 50 });

    // Multi-mode: today modes set including this one
    const modesToday = new Set((todayLogs || []).map((l: any) => l.mode));
    modesToday.add(mode);
    if (modesToday.size === 3) bonuses.push({ key: `multi_mode_${ymd}`, points: 25 });

    // Difficulty Master: 10 hard today
    const hardToday = (todayLogs || []).filter((l: any) => l.difficulty === "hard").length + (difficulty === "hard" ? 1 : 0);
    if (hardToday === 10) bonuses.push({ key: `difficulty_master_${ymd}`, points: 100 });

    // Mixed difficulty: 5 each today
    const tally = (d: string) => (todayLogs || []).filter((l: any) => l.difficulty === d).length + (difficulty === d ? 1 : 0);
    if (tally("easy") >= 5 && tally("medium") >= 5 && tally("hard") >= 5) {
      bonuses.push({ key: `mixed_difficulty_${ymd}`, points: 75 });
    }

    // Insert bonuses (idempotent)
    for (const b of bonuses) {
      await svc.from("challenge_bonuses_awarded").insert({
        challenge_id: ch.id, user_id: user.id, bonus_key: b.key, points: b.points,
      }).then(() => {}, () => {}); // ignore duplicate
    }

    // Recompute mode totals & mastery
    const { data: allLogs } = await svc.from("challenge_game_logs")
      .select("mode, score, counted_toward_score").eq("challenge_id", ch.id).eq("user_id", user.id);
    const modePts = (m: string) => (allLogs || []).filter((l: any) => l.mode === m && l.counted_toward_score).reduce((s: number, l: any) => s + l.score, 0);
    const lyrics_points = modePts("lyrics");
    const melody_points = modePts("melody");
    const category_points = modePts("category");

    const masteryKeys: { key: string; cond: boolean; points: number }[] = [
      { key: "lyrics_master", cond: lyrics_points >= 500, points: 50 },
      { key: "melody_master", cond: melody_points >= 500, points: 75 },
      { key: "category_master", cond: category_points >= 500, points: 50 },
    ];
    for (const m of masteryKeys) {
      if (m.cond) {
        await svc.from("challenge_bonuses_awarded").insert({
          challenge_id: ch.id, user_id: user.id, bonus_key: m.key, points: m.points,
        }).then(() => {}, () => {});
      }
    }
    // Songmatch master if all 3 mastery earned
    const { data: earned } = await svc.from("challenge_bonuses_awarded")
      .select("bonus_key").eq("challenge_id", ch.id).eq("user_id", user.id)
      .in("bonus_key", ["lyrics_master", "melody_master", "category_master"]);
    if ((earned || []).length === 3) {
      await svc.from("challenge_bonuses_awarded").insert({
        challenge_id: ch.id, user_id: user.id, bonus_key: "songmatch_master", points: 200,
      }).then(() => {}, () => {});
    }

    // Recalc total
    const { data: bonusRows } = await svc.from("challenge_bonuses_awarded")
      .select("points").eq("challenge_id", ch.id).eq("user_id", user.id);
    const logTotal = (allLogs || []).filter((l: any) => l.counted_toward_score).reduce((s: number, l: any) => s + l.score, 0);
    const bonusTotal = (bonusRows || []).reduce((s: number, b: any) => s + b.points, 0);
    const games_played = (allLogs || []).filter((l: any) => l.counted_toward_score).length;
    const qualified = games_played >= (ch.qualification_min_games ?? 10);

    await svc.from("challenge_scores").upsert({
      challenge_id: ch.id, user_id: user.id,
      total_score: logTotal + bonusTotal,
      games_played, lyrics_points, melody_points, category_points, qualified,
    }, { onConflict: "challenge_id,user_id" });

    return json({ success: true, counted, total: logTotal + bonusTotal, qualified });
  } catch (e: any) {
    return json({ error: e.message }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
