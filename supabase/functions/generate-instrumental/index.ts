import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

const GATEWAY = "https://connector-gateway.lovable.dev/replicate/v1";
const DEMUCS_VERSION = "ff5ad47d2685b27c0f820ee134c4394140804f08fa755cb20c846459faa4b337";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), songId: z.string().uuid() }),
  z.object({ action: z.literal("check"), songId: z.string().uuid(), predictionId: z.string().min(1).max(100).regex(/^[a-z0-9]+$/) }),
]);

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function toDirectUrl(url: string) {
  const m = url.match(/\/file\/d\/([^/]+)/);
  return m ? `https://drive.google.com/uc?export=download&id=${m[1]}` : url;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
    if (!LOVABLE_API_KEY || !REPLICATE_API_KEY) return json({ error: "Replicate is not configured" }, 500);

    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Auth + admin check
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: userData } = await admin.auth.getUser(token);
    if (!userData?.user) return json({ error: "Not authenticated" }, 401);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Admins only" }, 403);

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const body = parsed.data;

    const auth = { Authorization: `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": REPLICATE_API_KEY };

    const { data: song } = await admin.from("songs").select("id, title, audio_url").eq("id", body.songId).maybeSingle();
    if (!song) return json({ error: "Song not found" }, 404);

    if (body.action === "start") {
      if (!song.audio_url) return json({ error: "This song has no audio file" }, 400);
      const res = await fetch(`${GATEWAY}/predictions`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({
          version: DEMUCS_VERSION,
          input: { audio: toDirectUrl(song.audio_url), stem: "vocals", model: "htdemucs", output_format: "mp3", mp3_bitrate: 320 },
        }),
      });
      if (res.status === 402) return json({ error: "Replicate account has no credit. Add billing at replicate.com/account/billing." }, 402);
      if (!res.ok) {
        const t = await res.text();
        console.error(`Replicate create failed [${res.status}]: ${t}`);
        return json({ error: "Replicate request failed", status: res.status, details: t }, res.status);
      }
      const pred = await res.json();
      return json({ predictionId: pred.id, status: pred.status });
    }

    // check
    const res = await fetch(`${GATEWAY}/predictions/${body.predictionId}`, { headers: auth });
    if (!res.ok) {
      const t = await res.text();
      return json({ error: "Replicate request failed", status: res.status, details: t }, res.status);
    }
    const pred = await res.json();
    if (pred.status === "failed" || pred.status === "canceled") return json({ status: pred.status, error: pred.error || "Separation failed" });
    if (pred.status !== "succeeded") return json({ status: pred.status });

    const outUrl: string | undefined = pred.output?.no_vocals;
    if (!outUrl) return json({ status: "failed", error: "No instrumental output returned" });

    const audioRes = await fetch(outUrl);
    if (!audioRes.ok) return json({ status: "failed", error: "Could not download instrumental" });
    const buf = await audioRes.arrayBuffer();
    const path = `generated/${song.id}-${Date.now()}.mp3`;
    const { error: upErr } = await admin.storage.from("song-instrumentals").upload(path, buf, { contentType: "audio/mpeg", upsert: true });
    if (upErr) return json({ status: "failed", error: upErr.message });
    const publicUrl = admin.storage.from("song-instrumentals").getPublicUrl(path).data.publicUrl;
    const { error: updErr } = await admin.from("songs").update({ instrumental_url: publicUrl }).eq("id", song.id);
    if (updErr) return json({ status: "failed", error: updErr.message });

    return json({ status: "succeeded", instrumentalUrl: publicUrl });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
