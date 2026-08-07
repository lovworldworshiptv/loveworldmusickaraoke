import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { KC_LOGIN_URL, corsHeaders, getClientId, normalizePlatform, safeInternalPath } from "../_shared/kingschat.ts";

// GET /kingschat-login?next=/library
// Issues a per-attempt CSRF token (stored server-side) and redirects the user
// to the KingsChat hosted login page.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const redirectPath = safeInternalPath(url.searchParams.get("next"));
    const wantsJson = url.searchParams.get("format") === "json";

    const origin = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { error } = await supabase.from("kingschat_auth_sessions").insert({
      nonce: origin,
      redirect_path: redirectPath,
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
    if (error) throw new Error(error.message);

    const loginUrl = `${KC_LOGIN_URL}?clientId=${encodeURIComponent(getClientId())}&origin=${encodeURIComponent(origin)}`;

    if (wantsJson) {
      return new Response(JSON.stringify({ url: loginUrl, origin, redirect_path: redirectPath }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(null, { status: 302, headers: { ...corsHeaders, Location: loginUrl } });
  } catch (err: any) {
    console.error("KC login error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
