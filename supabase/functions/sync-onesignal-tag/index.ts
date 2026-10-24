import { createClient } from "npm:@supabase/supabase-js@2";
import { updateUserInAllApps } from "../_shared/onesignal.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const unauthorized = () =>
  new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: jsonHeaders });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return unauthorized();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    const userId = claimsData?.claims?.sub as string | undefined;
    if (claimsError || !userId) {
      console.warn("sync-onesignal-tag: rejected token", claimsError?.message ?? "no user in token");
      return unauthorized();
    }

    // Get user subscription
    const { data: sub } = await supabase
      .from("user_subscriptions")
      .select("subscription")
      .eq("user_id", userId)
      .maybeSingle();

    const subscription = sub?.subscription || "free";

    // Update the subscription tag in every configured OneSignal app (website + Android).
    // A user who has only used one platform gets a 404 from the other app — expected.
    const results = await updateUserInAllApps(userId, { properties: { tags: { subscription } } });

    return new Response(JSON.stringify({ success: results.some((r) => r.ok), subscription, data: results }), {
      headers: jsonHeaders,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: jsonHeaders });
  }
});
