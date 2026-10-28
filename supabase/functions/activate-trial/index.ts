import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from token
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // A free trial can only ever be used once per account.
    const { data: sub } = await supabase
      .from("user_subscriptions")
      .select("subscription, subscription_expiry_date, trial_used_at")
      .eq("user_id", user.id)
      .maybeSingle();

    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    if (sub?.trial_used_at) {
      return json({ error: "You have already used your free trial. Choose a Premium plan to continue." }, 400);
    }
    const active = sub && (sub.subscription === "premium" || sub.subscription === "trial")
      && (!sub.subscription_expiry_date || new Date(sub.subscription_expiry_date) > new Date());
    if (active) {
      return json({ error: "You already have an active premium subscription" }, 400);
    }

    // Activate trial — only if it has never been used (guards against double taps too).
    const now = new Date();
    const expiry = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const values = {
      subscription: "trial",
      subscription_plan: "3_day_trial",
      subscription_start_date: now.toISOString(),
      subscription_expiry_date: expiry.toISOString(),
    };

    let updateError = null;
    if (sub) {
      const { data: rows, error } = await supabase
        .from("user_subscriptions")
        .update(values)
        .eq("user_id", user.id)
        .is("trial_used_at", null)
        .select("user_id");
      updateError = error;
      if (!error && (!rows || rows.length === 0)) {
        return json({ error: "You have already used your free trial. Choose a Premium plan to continue." }, 400);
      }
    } else {
      const { error } = await supabase.from("user_subscriptions").insert({ user_id: user.id, ...values });
      updateError = error;
    }
    if (updateError && /TRIAL_ALREADY_USED/.test(updateError.message)) {
      return json({ error: "You have already used your free trial. Choose a Premium plan to continue." }, 400);
    }

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true, expiry: expiry.toISOString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
