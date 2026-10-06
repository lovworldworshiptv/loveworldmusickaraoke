import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("summary") }),
  z.object({ action: z.literal("enqueue_missing") }),
  z.object({ action: z.literal("retry"), songId: z.string().uuid() }),
  z.object({ action: z.literal("resume") }),
]);

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: u } = await admin.auth.getUser(token);
    if (!u?.user) return json({ error: "Not authenticated" }, 401);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Admins only" }, 403);

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const body = parsed.data;

    const kick = () => fetch(`${url}/functions/v1/stem-worker`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch((e) => console.error("kick failed", e));

    if (body.action === "enqueue_missing") {
      const { data: songs } = await admin.from("songs").select("id, original_language").not("audio_url", "is", null).is("instrumental_url", null);
      const { data: existing } = await admin.from("song_audio_versions").select("song_id, status").eq("kind", "instrumental");
      const busy = new Set((existing ?? []).filter((r) => r.status !== "failed").map((r) => r.song_id));
      const rows = (songs ?? []).filter((s) => !busy.has(s.id)).map((s) => ({
        song_id: s.id, language_code: s.original_language || "en", kind: "instrumental", status: "pending", attempts: 0, error: null, prediction_id: null, source: "auto",
      }));
      if (rows.length) {
        const { error } = await admin.from("song_audio_versions").upsert(rows, { onConflict: "song_id,language_code,kind" });
        if (error) return json({ error: error.message }, 500);
        await kick();
      }
      return json({ queued: rows.length });
    }

    if (body.action === "retry") {
      const { data: song } = await admin.from("songs").select("id, original_language").eq("id", body.songId).maybeSingle();
      if (!song) return json({ error: "Song not found" }, 404);
      const { error } = await admin.from("song_audio_versions").upsert({
        song_id: song.id, language_code: song.original_language || "en", kind: "instrumental", status: "pending", attempts: 0, error: null, prediction_id: null, source: "auto",
      }, { onConflict: "song_id,language_code,kind" });
      if (error) return json({ error: error.message }, 500);
      await kick();
      return json({ ok: true });
    }

    if (body.action === "resume") {
      await admin.from("stem_worker_state").update({ paused_reason: null, paused_at: null }).eq("id", 1);
      await kick();
      return json({ ok: true });
    }

    // summary
    const [{ data: rows }, { count: missingCount }, { data: state }] = await Promise.all([
      admin.from("song_audio_versions").select("song_id, status, error, attempts").eq("kind", "instrumental"),
      admin.from("songs").select("id", { count: "exact", head: true }).not("audio_url", "is", null).is("instrumental_url", null),
      admin.from("stem_worker_state").select("paused_reason").eq("id", 1).maybeSingle(),
    ]);
    const counts = { pending: 0, processing: 0, ready: 0, failed: 0 } as Record<string, number>;
    for (const r of rows ?? []) counts[r.status] = (counts[r.status] ?? 0) + 1;
    const queued = new Set((rows ?? []).filter((r) => r.status !== "failed").map((r) => r.song_id));
    const { data: missingSongs } = await admin.from("songs").select("id").not("audio_url", "is", null).is("instrumental_url", null);
    const notQueued = (missingSongs ?? []).filter((s) => !queued.has(s.id)).length;
    return json({ counts, missingTotal: missingCount ?? 0, notQueued, paused: state?.paused_reason ?? null, rows: rows ?? [] });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
