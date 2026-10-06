import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MILESTONE_MESSAGES: Record<string, { title: string; message: (days: number) => string }> = {
  "7": {
    title: "Your Premium is ending soon",
    message: () => "Your Premium subscription expires in 7 days. Renew now to keep offline downloads, premium features and your saved music.",
  },
  "3": {
    title: "3 days of Premium left",
    message: () => "Your Premium subscription expires in 3 days. Renew now to keep your premium access and offline downloads.",
  },
  "1": {
    title: "Last day of Premium",
    message: () => "Your Premium subscription expires tomorrow. Renew now so you don't lose your premium features.",
  },
  "0": {
    title: "Premium expires today",
    message: () => "Your Premium subscription expires today. Renew now to keep uninterrupted access.",
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date().toISOString();

    // 1. Revert expired premium/trial subscriptions to free
    const { data: expired, error: expErr } = await supabase
      .from("user_subscriptions")
      .select("user_id, subscription_expiry_date")
      .in("subscription", ["premium", "trial"])
      .not("subscription_expiry_date", "is", null)
      .lt("subscription_expiry_date", now);

    if (expErr) throw expErr;

    let revertedCount = 0;
    for (const sub of expired || []) {
      await supabase
        .from("user_subscriptions")
        .update({ subscription: "free", subscription_plan: "none" })
        .eq("user_id", sub.user_id);
      revertedCount++;
    }

    // 2. Renewal reminders at 7 / 3 / 1 / 0 days before expiry
    const { data: active, error: actErr } = await supabase
      .from("user_subscriptions")
      .select("user_id, subscription, subscription_expiry_date")
      .in("subscription", ["premium", "trial"])
      .not("subscription_expiry_date", "is", null)
      .gt("subscription_expiry_date", now);

    if (actErr) throw actErr;

    let reminderCount = 0;

    for (const sub of active || []) {
      const expiry = new Date(sub.subscription_expiry_date).getTime();
      const daysLeft = Math.floor((expiry - Date.now()) / 86400000);
      const milestone = daysLeft <= 0 ? "0" : daysLeft <= 2 ? "1" : daysLeft <= 6 ? "3" : daysLeft <= 13 ? "7" : null;
      if (!milestone) continue;

      // Skip if this milestone was already sent to this user
      const { data: existing } = await supabase
        .from("renewal_reminders")
        .select("id")
        .eq("user_id", sub.user_id)
        .eq("milestone", milestone)
        .maybeSingle();
      if (existing) continue;

      const tmpl = MILESTONE_MESSAGES[milestone];
      const isTrial = sub.subscription === "trial";
      const title = isTrial ? tmpl.title.replace("Premium", "Free trial") : tmpl.title;
      const message = isTrial ? tmpl.message(daysLeft).replace(/Premium/g, "free trial") : tmpl.message(daysLeft);

      // Record so the reminder is never sent twice for the same milestone
      const { data: reminder, error: rrErr } = await supabase
        .from("renewal_reminders")
        .insert({ user_id: sub.user_id, milestone })
        .select("id")
        .single();
      if (rrErr) continue; // unique constraint = already sent

      const { data: notification } = await supabase
        .from("notifications")
        .insert({
          title,
          message,
          segment: "custom",
          status: "sent",
          sent_at: now,
          created_by: "00000000-0000-0000-0000-000000000000",
        })
        .select("id")
        .single();

      if (notification) {
        await supabase.from("user_notifications").insert({ user_id: sub.user_id, notification_id: notification.id });
      }

      // OneSignal push (best effort — never blocks the job)
      try {
        const appId = Deno.env.get("ONESIGNAL_APP_ID");
        const apiKey = Deno.env.get("ONESIGNAL_REST_API_KEY");
        if (appId && apiKey) {
          await fetch("https://onesignal.com/api/v1/notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Basic ${apiKey}` },
            body: JSON.stringify({
              app_id: appId,
              headings: { en: title },
              contents: { en: message },
              include_external_user_ids: [sub.user_id],
              channel_for_external_user_ids: "push",
            }),
          });
        }
      } catch (pushErr) {
        console.error("OneSignal renewal push failed:", pushErr);
      }

      reminderCount++;
    }

    return new Response(
      JSON.stringify({ success: true, reverted: revertedCount, reminders_sent: reminderCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
