import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    // 1. Revert expired premium subscriptions to free
    const { data: expired, error: expErr } = await supabase
      .from("user_subscriptions")
      .select("user_id, subscription_expiry_date")
      .eq("subscription", "premium")
      .not("subscription_expiry_date", "is", null)
      .lt("subscription_expiry_date", now);

    if (expErr) throw expErr;

    let revertedCount = 0;
    for (const sub of expired || []) {
      await supabase
        .from("user_subscriptions")
        .update({
          subscription: "free",
          subscription_plan: "none",
        })
        .eq("user_id", sub.user_id);
      revertedCount++;
    }

    // 2. Send 3-day expiry reminders
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    const threeDaysIso = threeDaysFromNow.toISOString();

    // Find users whose subscription expires within the next 3 days but hasn't expired yet
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: expiringSoon, error: remErr } = await supabase
      .from("user_subscriptions")
      .select("user_id")
      .eq("subscription", "premium")
      .not("subscription_expiry_date", "is", null)
      .gt("subscription_expiry_date", now)
      .lte("subscription_expiry_date", threeDaysIso);

    if (remErr) throw remErr;

    let reminderCount = 0;
    if (expiringSoon && expiringSoon.length > 0) {
      // Create a notification for expiry reminder
      const { data: notification } = await supabase
        .from("notifications")
        .insert({
          title: "Subscription Expiring Soon",
          message: "Your premium subscription expires in less than 3 days. Renew now to keep your premium access and offline downloads.",
          segment: "custom",
          status: "sent",
          sent_at: now,
          created_by: "00000000-0000-0000-0000-000000000000",
        })
        .select("id")
        .single();

      if (notification) {
        const userNotifications = expiringSoon.map((u) => ({
          user_id: u.user_id,
          notification_id: notification.id,
        }));

        await supabase.from("user_notifications").insert(userNotifications);
        reminderCount = expiringSoon.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        reverted: revertedCount,
        reminders_sent: reminderCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
