import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const TRIAL_USED = "You have already used your free 3-day trial. Choose a Premium plan to continue.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Not authenticated" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Invalid token" }, 401);

    const { data: sub } = await supabase
      .from("user_subscriptions")
      .select("subscription, subscription_plan, subscription_expiry_date, trial_used_at")
      .eq("user_id", user.id)
      .maybeSingle();

    const active = sub?.subscription_expiry_date ? new Date(sub.subscription_expiry_date) > new Date() : sub?.subscription === "premium";
    if (sub?.subscription === "premium" && active) {
      return json({ error: "You already have an active premium subscription" }, 400);
    }
    // The free trial is one-time only, ever.
    if (sub?.trial_used_at || sub?.subscription === "trial" || sub?.subscription_plan === "3_day_trial") {
      return json({ error: TRIAL_USED, trial_used: true }, 400);
    }

    const now = new Date();
    const expiry = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const fields = {
      subscription: "trial",
      subscription_plan: "3_day_trial",
      subscription_start_date: now.toISOString(),
      subscription_expiry_date: expiry.toISOString(),
      trial_used_at: now.toISOString(),
    };

    if (sub) {
      // Conditional update: only succeeds while the trial is still unused (blocks double taps / races).
      const { data: updated, error: updateError } = await supabase
        .from("user_subscriptions")
        .update(fields)
        .eq("user_id", user.id)
        .is("trial_used_at", null)
        .select("user_id");
      if (updateError) throw updateError;
      if (!updated || updated.length === 0) return json({ error: TRIAL_USED, trial_used: true }, 400);
    } else {
      const { error: insertError } = await supabase.from("user_subscriptions").insert({ user_id: user.id, ...fields });
      if (insertError) return json({ error: TRIAL_USED, trial_used: true }, 400);
    }

    return json({ success: true, expiry: expiry.toISOString() });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
});
