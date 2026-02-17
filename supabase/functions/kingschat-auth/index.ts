import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const KC_API = "https://connect.kingsch.at";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { accessToken } = await req.json();
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Missing accessToken" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch user profile from KingsChat API
    const profileRes = await fetch(`${KC_API}/api/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!profileRes.ok) {
      // Try alternative endpoint
      const altRes = await fetch(`${KC_API}/api/users/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      });

      if (!altRes.ok) {
        const errText = await altRes.text();
        console.error("KingsChat profile fetch failed:", altRes.status, errText);
        return new Response(
          JSON.stringify({ error: "Failed to fetch KingsChat profile", details: errText }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      var kcProfile = await altRes.json();
    } else {
      var kcProfile = await profileRes.json();
    }

    console.log("KingsChat profile response:", JSON.stringify(kcProfile));

    // Extract user data - try multiple possible field names
    const kcData = kcProfile.data || kcProfile.user || kcProfile;
    const kcUsername =
      kcData.username || kcData.display_name || kcData.displayName || kcData.name || kcData.full_name || kcData.fullName || "KingsChat User";
    const kcAvatar =
      kcData.avatar || kcData.avatar_url || kcData.avatarUrl || kcData.profile_image || kcData.profileImage || kcData.photo || kcData.image || null;
    const kcEmail = kcData.email || null;
    const kcId = String(kcData.id || kcData.user_id || kcData.userId || "");

    if (!kcId) {
      return new Response(
        JSON.stringify({ error: "Could not determine KingsChat user ID", profile: kcData }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use Supabase service role to manage auth
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Generate a deterministic email for KingsChat users
    const fakeEmail = `kc_${kcId}@kingschat.local`;
    const password = `kc_auth_${kcId}_${serviceKey.slice(-8)}`;

    // Try sign in first
    let { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({ email: fakeEmail, password });

    if (signInError) {
      // User doesn't exist, create them
      const { data: signUpData, error: signUpError } = await supabase.auth.admin.createUser({
        email: fakeEmail,
        password,
        email_confirm: true,
        user_metadata: {
          username: kcUsername,
          avatar_url: kcAvatar,
          provider: "kingschat",
          kingschat_id: kcId,
        },
      });

      if (signUpError) {
        console.error("Sign up error:", signUpError);
        return new Response(
          JSON.stringify({ error: "Failed to create user", details: signUpError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Sign in the newly created user
      const { data: newSignIn, error: newSignInError } =
        await supabase.auth.signInWithPassword({ email: fakeEmail, password });

      if (newSignInError) {
        return new Response(
          JSON.stringify({ error: "Failed to sign in new user", details: newSignInError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      signInData = newSignIn;
    }

    const userId = signInData.user!.id;

    // Update profile with KingsChat data
    await supabase
      .from("profiles")
      .update({
        username: kcUsername,
        avatar_url: kcAvatar,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    return new Response(
      JSON.stringify({
        session: signInData.session,
        user: signInData.user,
        kingschat_profile: {
          username: kcUsername,
          avatar_url: kcAvatar,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("KingsChat auth error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
