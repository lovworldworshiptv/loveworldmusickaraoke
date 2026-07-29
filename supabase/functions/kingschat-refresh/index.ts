import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, expiryFromTokens, refreshTokens } from "../_shared/kingschat.ts";

// POST /kingschat-refresh  (requires the app's Authorization: Bearer <jwt>)
// Returns a valid KingsChat access token for the signed-in user, refreshing and
// overwriting the stored tokens when the current one has expired.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: userData, error: userError } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const { data: row } = await admin
      .from("kingschat_oauth_tokens")
      .select("access_token, refresh_token, expires_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (!row) {
      return new Response(JSON.stringify({ error: "No KingsChat tokens stored for this user" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const expired = new Date(row.expires_at).getTime() - 60_000 < Date.now();
    if (!expired) {
      return new Response(JSON.stringify({ refreshed: false, expires_at: row.expires_at }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!row.refresh_token) throw new Error("No refresh token stored; user must sign in again");

    const tokens = await refreshTokens(row.refresh_token);
    const expiresAt = expiryFromTokens(tokens);

    await admin.from("kingschat_oauth_tokens").update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? row.refresh_token,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId);

    return new Response(JSON.stringify({ refreshed: true, expires_at: expiresAt }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("KC refresh error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
