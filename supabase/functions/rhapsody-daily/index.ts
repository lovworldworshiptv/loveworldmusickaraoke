import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

/**
 * Fallback reader for today's Rhapsody of Realities devotional.
 * Returns the raw `window.dailyDevotional` object; the app normalises and sanitises it.
 */
const SOURCE = "https://read.rhapsodyofrealities.org/";

function extract(html: string): unknown | null {
  const marker = html.search(/window\.dailyDevotional\s*=\s*\{/);
  if (marker < 0) return null;
  const start = html.indexOf("{", marker);
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) {
      try { return JSON.parse(html.slice(start, i + 1)); } catch { return null; }
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const res = await fetch(SOURCE, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LoveworldMusicPlus/1.0)" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`Source answered ${res.status}`);
    const data = extract(await res.text());
    if (!data) throw new Error("Devotional not found on page");
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
