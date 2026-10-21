import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

/**
 * Turns a pasted video link into a directly playable file URL.
 * - YouTube links are returned unchanged (played through the embed).
 * - KingsSpace watch pages are resolved to their CeFlix MP4 file.
 * - Any other link must actually answer with a video file, not a web page.
 */
const Body = z.object({ url: z.string().url().max(2048) });
const UA = "Mozilla/5.0 (compatible; LoveworldMusicPlus/1.0)";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const isYouTube = (u: string) => /(?:youtu\.be\/|youtube\.com\/)/i.test(u);

/** Range-probe a URL and report whether it serves video bytes. */
async function probe(url: string) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Range: "bytes=0-1023" }, redirect: "follow", signal: AbortSignal.timeout(15000) });
  const type = (res.headers.get("content-type") || "").toLowerCase();
  await res.body?.cancel();
  const ok = (res.status === 200 || res.status === 206) && (type.startsWith("video/") || type.includes("mpegurl") || type === "application/octet-stream" || type === "binary/octet-stream");
  return { ok, status: res.status, type, finalUrl: res.url || url };
}

async function resolveKingsSpace(url: string) {
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`KingsSpace page answered ${res.status}`);
  const html = await res.text();
  const m = html.match(/ceflix\.org(?:%2F|\/)thumb(?:%2F|\/)([\w-]+)\.jpg/i);
  if (!m) throw new Error("Couldn't find the video file on this KingsSpace page");
  return { url: `https://cdnvideos.ceflix.org/processed/${m[1]}.mp4`, thumbnail: `https://cdnvideos.ceflix.org/thumb/${m[1]}.jpg` };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: u } = await admin.auth.getUser(token);
    if (!u?.user) return json({ error: "Not authenticated" }, 401);
    const [{ data: isAdmin }, { data: isEditor }] = await Promise.all([
      admin.rpc("has_role", { _user_id: u.user.id, _role: "admin" }),
      admin.rpc("has_role", { _user_id: u.user.id, _role: "editor" }),
    ]);
    if (!isAdmin && !isEditor) return json({ error: "Admins and editors only" }, 403);

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Enter a full https:// video link" }, 400);
    const input = parsed.data.url.trim();
    if (!/^https:\/\//i.test(input)) return json({ error: "Enter a full https:// video link" }, 400);

    if (isYouTube(input)) return json({ url: input, thumbnail: null, source: "youtube" });

    let target = input;
    let thumbnail: string | null = null;
    let source = "direct";
    if (/(^|\.)kingsspace\.online$/i.test(new URL(input).hostname)) {
      const r = await resolveKingsSpace(input);
      target = r.url; thumbnail = r.thumbnail; source = "kingsspace";
    }

    const p = await probe(target);
    if (!p.ok) {
      const page = p.type.includes("text/html");
      return json({
        error: page
          ? "This link opens a web page, not a video file. Paste the direct video link (usually ending in .mp4) or a YouTube link."
          : `This link didn't return a playable video (status ${p.status}).`,
      }, 422);
    }
    return json({ url: target, thumbnail, source });
  } catch (e) {
    console.error("resolve-video-url", e);
    if (e instanceof DOMException && (e.name === "TimeoutError" || e.name === "AbortError")) return json({ error: "The video link took too long to answer. Check the link and try again." }, 504);
    return json({ error: e instanceof Error ? e.message : "Couldn't check this video link" }, 500);
  }
});
