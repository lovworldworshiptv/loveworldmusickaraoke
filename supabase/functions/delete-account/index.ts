import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the calling user with their JWT
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    // Use service role for admin operations
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check if a targetUserId was provided (admin deleting another user)
    let targetUserId = user.id;
    try {
      const body = await req.json();
      if (body?.targetUserId && body.targetUserId !== user.id) {
        // Verify the caller is an admin
        const { data: adminRole } = await adminClient
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();

        if (!adminRole) {
          throw new Error("Only admins can delete other users");
        }
        targetUserId = body.targetUserId;
      }
    } catch (e) {
      // If body parsing fails (e.g. self-delete with no body), use authenticated user's ID
      if (e.message === "Only admins can delete other users") throw e;
    }

    // Delete user-owned data
    const tables = ["recently_played", "favorites", "playlist_songs", "playlists", "user_game_progress", "feedback", "profiles", "user_roles", "user_subscriptions", "downloads", "reminders", "karaoke_recordings", "user_achievements", "user_notifications"];
    for (const table of tables) {
      await adminClient.from(table).delete().eq("user_id", targetUserId);
    }

    // Delete the auth user
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(targetUserId);
    if (deleteError) throw deleteError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
