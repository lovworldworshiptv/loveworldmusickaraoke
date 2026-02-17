import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const KC_API = "https://connect.kingsch.at";

function decodeJwtPayload(token: string) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload;
  } catch {
    return null;
  }
}

async function fetchKcProfile(accessToken: string, userId: string) {
  // Try multiple possible endpoints
  const endpoints = [
    `${KC_API}/api/users/${userId}`,
    `${KC_API}/api/user/${userId}`,
    `${KC_API}/api/v1/users/${userId}`,
    `${KC_API}/api/v1/me`,
    `${KC_API}/api/me`,
    `${KC_API}/api/user`,
    `${KC_API}/api/profile`,
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      });
      if (res.ok) {
        const text = await res.text();
        console.log(`KingsChat endpoint ${url} raw (${res.status}): ${text.substring(0, 500)}`);
        try {
          const data = JSON.parse(text);
          console.log(`KingsChat profile found at ${url}`);
          return data;
        } catch {
          console.log(`KingsChat endpoint ${url} returned non-JSON response`);
        }
      } else {
        const text = await res.text();
        console.log(`KingsChat endpoint ${url} returned ${res.status}: ${text.substring(0, 200)}`);
      }
    } catch (e) {
      console.log(`KingsChat endpoint ${url} error: ${e.message}`);
    }
  }
  return null;
}

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

    // Decode JWT to extract user info
    const jwtPayload = decodeJwtPayload(accessToken);
    console.log("KingsChat JWT payload:", JSON.stringify(jwtPayload));

    const kcUserId = jwtPayload?.sub || "";
    const kcClientId = jwtPayload?.cid || "";

    if (!kcUserId) {
      return new Response(
        JSON.stringify({ error: "Invalid KingsChat token - no sub claim" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try to fetch profile from KingsChat API
    const kcProfileData = await fetchKcProfile(accessToken, kcUserId);

    // Extract user data from API response or fall back to JWT
    let kcUsername = "KingsChat User";
    let kcAvatar: string | null = null;

    if (kcProfileData) {
      const d = kcProfileData.data || kcProfileData.user || kcProfileData;
      kcUsername = d.username || d.display_name || d.displayName || d.name || d.full_name || d.fullName || d.firstName || kcUsername;
      kcAvatar = d.avatar || d.avatar_url || d.avatarUrl || d.profile_image || d.profileImage || d.photo || d.image || d.picture || null;
      
      // If name parts exist, combine them
      if (!d.username && !d.display_name && !d.name && d.firstName) {
        kcUsername = [d.firstName, d.lastName].filter(Boolean).join(" ");
      }
    } else {
      console.log("Could not fetch KingsChat profile from API, using JWT claims only");
      // Use whatever we can from the JWT
      kcUsername = jwtPayload?.name || jwtPayload?.username || `KingsChat_${kcUserId.substring(0, 8)}`;
    }

    // Use Supabase service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Deterministic credentials for KingsChat users
    const fakeEmail = `kc_${kcUserId}@kingschat.local`;
    const password = `kc_auth_${kcUserId}_${serviceKey.slice(-8)}`;

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
          kingschat_id: kcUserId,
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
