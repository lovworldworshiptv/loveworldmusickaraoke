import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Voice search: turns a short spoken or sung clip into search text.
 * Signed-in listeners only; the clip is forwarded to the AI Gateway
 * transcription endpoint and the streaming transcript is passed straight back.
 */
const GATEWAY = "https://ai.gateway.lovable.dev/v1/audio/transcriptions";
const MODEL = "openai/gpt-transcribe";
// ~20 s of 16 kHz mono WAV is 640 KB; anything far beyond that isn't a search query.
const MAX_FILE_BYTES = 3 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_FILE_BYTES + 64 * 1024;
const HINT =
  "A listener is searching a Christian worship music app by saying or singing a song title or a line of lyrics. " +
  "Songs are by Loveworld Singers (Praise Night, Healing Streams, Pastor Chris). Transcribe the words exactly.";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Sign in to search by voice" }, 401);
    const auth = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: claims, error: authError } = await auth.auth.getClaims(token);
    if (authError || !claims?.claims?.sub) return json({ error: "Sign in to search by voice" }, 401);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "Voice search isn't set up yet" }, 500);

    const declared = Number(req.headers.get("content-length") || "0");
    if (declared > MAX_REQUEST_BYTES) return json({ error: "That recording is too long. Try a shorter phrase." }, 413);
    const body = await req.arrayBuffer();
    if (body.byteLength > MAX_REQUEST_BYTES) return json({ error: "That recording is too long. Try a shorter phrase." }, 413);

    const form = await new Response(body, { headers: { "Content-Type": req.headers.get("content-type") || "" } }).formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size < 2048) return json({ error: "We didn't hear anything. Please try again." }, 400);
    if (file.size > MAX_FILE_BYTES) return json({ error: "That recording is too long. Try a shorter phrase." }, 413);
    if (!file.type.startsWith("audio/")) return json({ error: "Unsupported recording" }, 400);

    const upstream = new FormData();
    upstream.append("model", MODEL);
    upstream.append("file", file, file.name || "voice.wav");
    upstream.append("response_format", "json");
    upstream.append("stream", "true");
    upstream.append("prompt", HINT);

    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstream,
      signal: req.signal,
    });

    // Pass the gateway's status, type and body through unchanged (errors included).
    return new Response(res.body, {
      status: res.status,
      headers: {
        ...corsHeaders,
        "Content-Type": res.headers.get("content-type") || "application/json",
        "Cache-Control": "no-store",
        ...(res.headers.get("retry-after") ? { "Retry-After": res.headers.get("retry-after")! } : {}),
      },
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return new Response(null, { status: 499, headers: corsHeaders });
    console.error("voice-search failed", e);
    return json({ error: "Voice search failed. Please try again." }, 500);
  }
});
