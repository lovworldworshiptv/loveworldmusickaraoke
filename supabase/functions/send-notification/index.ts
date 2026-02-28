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
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const userId = claimsData.claims.sub as string;

    // Check admin role
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    const { title, message, image_url, deep_link, segment, scheduled_at } = await req.json();

    if (!title || !message || !segment) {
      return new Response(JSON.stringify({ error: "title, message, segment are required" }), { status: 400, headers: corsHeaders });
    }

    const status = scheduled_at ? "scheduled" : "pending";

    // 1. Save notification to DB
    const { data: notification, error: insertError } = await supabaseAdmin
      .from("notifications")
      .insert({ title, message, image_url, deep_link, segment, scheduled_at, status, created_by: userId })
      .select()
      .single();

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), { status: 500, headers: corsHeaders });
    }

    // 2. Create user_notification records for targeted users
    let userQuery = supabaseAdmin.from("user_subscriptions").select("user_id");
    if (segment === "free") {
      userQuery = userQuery.eq("subscription", "free");
    } else if (segment === "premium") {
      userQuery = userQuery.eq("subscription", "premium");
    }
    // segment === "all" → no filter

    const { data: users } = await userQuery;
    if (users && users.length > 0) {
      const records = users.map((u: any) => ({
        user_id: u.user_id,
        notification_id: notification.id,
      }));
      await supabaseAdmin.from("user_notifications").insert(records);
    }

    // 3. Send or schedule via OneSignal
    if (!scheduled_at) {
      const onesignalResult = await sendOneSignalPush({
        title, message, image_url, deep_link, segment,
      });

      await supabaseAdmin
        .from("notifications")
        .update({ status: onesignalResult.success ? "sent" : "failed", sent_at: new Date().toISOString(), onesignal_id: onesignalResult.id })
        .eq("id", notification.id);

      return new Response(JSON.stringify({ success: true, notification_id: notification.id, onesignal: onesignalResult }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For scheduled: use OneSignal's send_after
    const onesignalResult = await sendOneSignalPush({
      title, message, image_url, deep_link, segment, send_after: scheduled_at,
    });

    await supabaseAdmin
      .from("notifications")
      .update({ status: onesignalResult.success ? "scheduled" : "failed", onesignal_id: onesignalResult.id })
      .eq("id", notification.id);

    return new Response(JSON.stringify({ success: true, notification_id: notification.id, onesignal: onesignalResult }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});

async function sendOneSignalPush(opts: {
  title: string;
  message: string;
  image_url?: string;
  deep_link?: string;
  segment: string;
  send_after?: string;
}) {
  const appId = Deno.env.get("ONESIGNAL_APP_ID")!;
  const apiKey = Deno.env.get("ONESIGNAL_REST_API_KEY")!;

  const payload: any = {
    app_id: appId,
    headings: { en: opts.title },
    contents: { en: opts.message },
  };

  if (opts.image_url) payload.big_picture = opts.image_url;
  if (opts.deep_link) payload.url = opts.deep_link;
  if (opts.send_after) payload.send_after = opts.send_after;

  if (opts.segment === "all") {
    payload.included_segments = ["All"];
  } else {
    payload.included_segments = ["All"];
    payload.filters = [
      { field: "tag", key: "subscription", relation: "=", value: opts.segment },
    ];
  }

  try {
    const res = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    return { success: res.ok, id: data.id || null, errors: data.errors || null };
  } catch (e) {
    return { success: false, id: null, errors: [e.message] };
  }
}
