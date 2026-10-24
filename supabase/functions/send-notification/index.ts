import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendPushToAllApps, type PushContent } from "../_shared/onesignal.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userId = user.id;

    // Check admin role
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { title, message, image_url, deep_link, action_url, segment, scheduled_at, target_user_ids } = await req.json();

    if (!title || !message || !segment) {
      return new Response(JSON.stringify({ error: "title, message, segment are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const status = scheduled_at ? "scheduled" : "pending";

    // 1. Save notification to DB
    const insertData: any = { title, message, image_url, deep_link, action_url, segment, scheduled_at, status, created_by: userId };
    if (segment === "direct" && target_user_ids) {
      insertData.target_user_ids = target_user_ids;
    }

    const { data: notification, error: insertError } = await supabaseAdmin
      .from("notifications")
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: insertError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. Create user_notification records for targeted users
    let targetIds: string[] = [];

    if (segment === "direct" && target_user_ids && target_user_ids.length > 0) {
      targetIds = target_user_ids;
    } else {
      // Page through every account (default API limit is 1000 rows).
      const PAGE = 1000;
      for (let from = 0; ; from += PAGE) {
        let q: any = segment === "all"
          ? supabaseAdmin.from("profiles").select("user_id")
          : supabaseAdmin.from("user_subscriptions").select("user_id")
              .eq("subscription", segment === "premium" ? "premium" : "free");
        const { data: users, error } = await q.order("user_id").range(from, from + PAGE - 1);
        if (error) { console.error("Target lookup error:", error); break; }
        targetIds.push(...(users || []).map((u: any) => u.user_id));
        if (!users || users.length < PAGE) break;
      }
    }

    targetIds = Array.from(new Set(targetIds.filter(Boolean)));
    for (let i = 0; i < targetIds.length; i += 500) {
      const records = targetIds.slice(i, i + 500).map((uid: string) => ({
        user_id: uid,
        notification_id: notification.id,
      }));
      const { error: unErr } = await supabaseAdmin.from("user_notifications")
        .upsert(records, { onConflict: "user_id,notification_id", ignoreDuplicates: true });
      if (unErr) console.error("user_notifications insert error:", unErr);
    }

    // 3. Send via OneSignal
    if (!scheduled_at) {
      const onesignalResult = await sendOneSignalPush({
        title, message, image_url, deep_link, action_url, segment, target_user_ids: segment === "direct" ? target_user_ids : undefined,
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
      title, message, image_url, deep_link, action_url, segment, send_after: scheduled_at,
      target_user_ids: segment === "direct" ? target_user_ids : undefined,
    });

    await supabaseAdmin
      .from("notifications")
      .update({ status: onesignalResult.success ? "scheduled" : "failed", onesignal_id: onesignalResult.id })
      .eq("id", notification.id);

    return new Response(JSON.stringify({ success: true, notification_id: notification.id, onesignal: onesignalResult }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("Send notification error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

async function sendOneSignalPush(opts: {
  title: string;
  message: string;
  image_url?: string;
  deep_link?: string;
  action_url?: string;
  segment: string;
  send_after?: string;
  target_user_ids?: string[];
}) {
  const content: PushContent = {
    title: opts.title,
    message: opts.message,
    image_url: opts.image_url,
    deep_link: opts.deep_link,
    action_url: opts.action_url,
    send_after: opts.send_after,
  };

  if (opts.segment === "direct" && opts.target_user_ids && opts.target_user_ids.length > 0) {
    content.external_user_ids = opts.target_user_ids;
  } else if (opts.segment === "all") {
    content.included_segments = ["All"];
  } else {
    content.included_segments = ["All"];
    content.filters = [
      { field: "tag", key: "subscription", relation: "=", value: opts.segment },
    ];
  }

  try {
    const result = await sendPushToAllApps(content);
    const errors = result.results.filter((r) => r.errors).map((r) => ({ platform: r.platform, errors: r.errors }));
    return { success: result.success, id: result.id, errors: errors.length ? errors : null, apps: result.results };
  } catch (e: any) {
    return { success: false, id: null, errors: [e.message], apps: [] };
  }
}
