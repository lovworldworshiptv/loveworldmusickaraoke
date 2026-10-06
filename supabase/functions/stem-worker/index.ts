import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const GATEWAY = "https://connector-gateway.lovable.dev/replicate/v1";
const DEMUCS_VERSION = "ff5ad47d2685b27c0f820ee134c4394140804f08fa755cb20c846459faa4b337";
const MAX_CONCURRENT = 3;
const MAX_ATTEMPTS = 3;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function toDirectUrl(url: string) {
  const m = url.match(/\/file\/d\/([^/]+)/);
  return m ? `https://drive.google.com/uc?export=download&id=${m[1]}` : url;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
  if (!LOVABLE_API_KEY || !REPLICATE_API_KEY) return json({ error: "Replicate is not configured" }, 500);
  const auth = { Authorization: `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": REPLICATE_API_KEY };

  const { data: state } = await admin.from("stem_worker_state").select("paused_reason").eq("id", 1).maybeSingle();
  if (state?.paused_reason) return json({ skipped: "paused", reason: state.paused_reason });

  const { data: got } = await admin.rpc("stem_worker_acquire", { p_seconds: 55 });
  if (!got) return json({ skipped: "locked" });

  const report = { checked: 0, finished: 0, failed: 0, started: 0 };
  const notify = (type: string, title: string, message: string, metadata: Record<string, unknown>) =>
    admin.from("admin_notifications").insert({ type, title, message, metadata }).then(({ error }) => {
      if (error) console.error("notify failed", error.message);
    });
  const pause = async (reason: string) => {
    await admin.from("stem_worker_state").update({ paused_reason: reason, paused_at: new Date().toISOString() }).eq("id", 1);
    await notify("stem_paused", "Stem splitting paused", reason, {});
  };
  const failRow = async (row: { id: string; attempts: number; song_id?: string; songTitle?: string }, error: string) => {
    const attempts = row.attempts + 1;
    const final = attempts >= MAX_ATTEMPTS;
    await admin.from("song_audio_versions").update({
      status: final ? "failed" : "pending", attempts, error, prediction_id: null,
    }).eq("id", row.id);
    report.failed++;
    if (final) {
      await notify("stem_failed", `Stem split failed: ${row.songTitle ?? "a song"}`, `${error} — needs a retry from Stem Studio.`, { song_id: row.song_id ?? null });
    }
  };

  try {
    // 1) Check running separations
    const { data: running } = await admin.from("song_audio_versions")
      .select("id, song_id, language_code, attempts, prediction_id, songs(title)")
      .eq("kind", "instrumental").eq("status", "processing").not("prediction_id", "is", null).limit(10);

    for (const row of running ?? []) {
      report.checked++;
      const songTitle = (row.songs as { title?: string } | null)?.title;
      const res = await fetch(`${GATEWAY}/predictions/${row.prediction_id}`, { headers: auth });
      if (res.status === 429) break;
      if (!res.ok) { console.error(`poll [${res.status}]: ${await res.text()}`); continue; }
      const pred = await res.json();
      if (pred.status === "failed" || pred.status === "canceled") { await failRow({ ...row, songTitle }, pred.error || "Separation failed"); continue; }
      if (pred.status !== "succeeded") continue;

      const inst: string | undefined = pred.output?.no_vocals;
      const voc: string | undefined = pred.output?.vocals;
      if (!inst) { await failRow(row, "No instrumental output returned"); continue; }

      const upload = async (src: string, bucket: string, path: string) => {
        const r = await fetch(src);
        if (!r.ok) throw new Error(`download failed ${r.status}`);
        const { error } = await admin.storage.from(bucket).upload(path, await r.arrayBuffer(), { contentType: "audio/mpeg", upsert: true });
        if (error) throw new Error(error.message);
        return admin.storage.from(bucket).getPublicUrl(path).data.publicUrl;
      };
      try {
        const stamp = Date.now();
        const instUrl = await upload(inst, "song-instrumentals", `generated/${row.song_id}-${stamp}.mp3`);
        await admin.from("song_audio_versions").update({ status: "ready", audio_url: instUrl, error: null, bitrate_kbps: 320 }).eq("id", row.id);
        await admin.from("songs").update({ instrumental_url: instUrl }).eq("id", row.song_id).is("instrumental_url", null);
        if (voc) {
          const vocUrl = await upload(voc, "song-audio", `stems/${row.song_id}-vocals-${stamp}.mp3`);
          await admin.from("song_audio_versions").upsert({
            song_id: row.song_id, language_code: row.language_code, kind: "vocals", status: "ready", audio_url: vocUrl, source: "auto", bitrate_kbps: 320,
          }, { onConflict: "song_id,language_code,kind" });
        }
        report.finished++;
        await notify("stem_completed", `Karaoke track ready: ${songTitle ?? "a song"}`, "The instrumental and vocals stems were saved and Karaoke mode is now available.", { song_id: row.song_id });
      } catch (e) {
        await failRow({ ...row, songTitle }, e instanceof Error ? e.message : "Save failed");
      }
    }

    // 2) Start new separations
    const { count: active } = await admin.from("song_audio_versions")
      .select("id", { count: "exact", head: true }).eq("kind", "instrumental").eq("status", "processing");
    const slots = Math.max(0, MAX_CONCURRENT - (active ?? 0));
    if (slots > 0) {
      const { data: pending } = await admin.from("song_audio_versions")
        .select("id, song_id, attempts").eq("kind", "instrumental").eq("status", "pending")
        .lt("attempts", MAX_ATTEMPTS).order("created_at").limit(slots);

      for (const row of pending ?? []) {
        const { data: song } = await admin.from("songs").select("audio_url, instrumental_url").eq("id", row.song_id).maybeSingle();
        if (!song?.audio_url) { await admin.from("song_audio_versions").update({ status: "failed", error: "Song has no audio" }).eq("id", row.id); continue; }
        if (song.instrumental_url && row.attempts === 0) {
          // Manual instrumental already present — never overwrite
          await admin.from("song_audio_versions").update({ status: "ready", audio_url: song.instrumental_url, source: "manual" }).eq("id", row.id);
          continue;
        }
        const res = await fetch(`${GATEWAY}/predictions`, {
          method: "POST",
          headers: { ...auth, "Content-Type": "application/json" },
          body: JSON.stringify({ version: DEMUCS_VERSION, input: { audio: toDirectUrl(song.audio_url), model: "htdemucs", stem: "vocals", output_format: "mp3", mp3_bitrate: 320 } }),
        });
        if (res.status === 402) { await pause("Replicate account has no credit. Add billing at replicate.com/account/billing, then press Resume."); break; }
        if (res.status === 403) { await pause(`Replicate denied the request: ${(await res.text()).slice(0, 200)}`); break; }
        if (res.status === 429) break;
        if (!res.ok) { await failRow(row, `Start failed [${res.status}]`); continue; }
        const pred = await res.json();
        await admin.from("song_audio_versions").update({ status: "processing", prediction_id: pred.id, started_at: new Date().toISOString(), error: null }).eq("id", row.id);
        report.started++;
      }
    }
  } finally {
    await admin.from("stem_worker_state").update({ lease_until: null }).eq("id", 1);
    await admin.rpc("stem_queue_disarm");
  }
  return json(report);
});
