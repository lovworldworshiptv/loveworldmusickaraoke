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
  // Try multiple endpoints with various Accept headers
  const attempts = [
    { url: `${KC_API}/api/users/${userId}`, accept: "application/json" },
    { url: `${KC_API}/api/users/${userId}`, accept: "*/*" },
    { url: `${KC_API}/api/users/${userId}/profile`, accept: "application/json" },
    { url: `${KC_API}/api/v1/users/${userId}`, accept: "application/json" },
    { url: `${KC_API}/api/me`, accept: "application/json" },
    { url: `${KC_API}/api/profile`, accept: "application/json" },
    { url: `${KC_API}/api/v1/me`, accept: "application/json" },
    { url: `${KC_API}/api/user`, accept: "application/json" },
    { url: `${KC_API}/oauth2/userinfo`, accept: "application/json" },
    { url: `${KC_API}/userinfo`, accept: "application/json" },
    { url: `https://accounts.kingsch.at/api/me`, accept: "application/json" },
    { url: `https://accounts.kingsch.at/api/users/${userId}`, accept: "application/json" },
    { url: `https://accounts.kingsch.at/oauth2/userinfo`, accept: "application/json" },
  ];

  for (const { url, accept } of attempts) {
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: accept,
          "Content-Type": "application/json",
        },
      });

      const contentType = res.headers.get("content-type") || "";
      console.log(`KC endpoint ${url} -> ${res.status} (${contentType})`);

      if (res.ok) {
        if (contentType.includes("json")) {
          const data = await res.json();
          console.log(`KC profile found at ${url}:`, JSON.stringify(data).substring(0, 500));
          return data;
        } else {
          // Try parsing as text, might be JSON without proper content-type
          const text = await res.text();
          console.log(`KC ${url} raw text (first 300): ${text.substring(0, 300)}`);
          try {
            return JSON.parse(text);
          } catch {
            console.log(`KC ${url} not parseable as JSON`);
          }
        }
      } else {
        const text = await res.text();
        console.log(`KC ${url} error: ${text.substring(0, 200)}`);
      }
    } catch (e) {
      console.log(`KC ${url} fetch error: ${e.message}`);
    }
  }
  return null;
}

function extractProfileFromResponse(fullResponse: any) {
  // The KingsChat popup might return user data alongside tokens
  if (!fullResponse) return null;
  
  const possibleFields = [
    "user", "profile", "userInfo", "user_info", "userData", "user_data",
    "account", "me", "identity",
  ];
  
  for (const field of possibleFields) {
    if (fullResponse[field] && typeof fullResponse[field] === "object") {
      return fullResponse[field];
    }
  }
  
  // Check if profile fields are directly on the response
  if (fullResponse.username || fullResponse.displayName || fullResponse.name || 
      fullResponse.avatar || fullResponse.photo || fullResponse.image) {
    return fullResponse;
  }
  
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { accessToken, fullResponse } = body;
    
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Missing accessToken" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log full response from client to discover available fields
    console.log("Full KingsChat auth response from client:", JSON.stringify(fullResponse || {}).substring(0, 1000));

    // Decode JWT to extract user info
    const jwtPayload = decodeJwtPayload(accessToken);
    console.log("KingsChat JWT payload:", JSON.stringify(jwtPayload));

    const kcUserId = jwtPayload?.sub || "";
    if (!kcUserId) {
      return new Response(
        JSON.stringify({ error: "Invalid KingsChat token - no sub claim" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try extracting profile from the login response first
    const clientProfile = extractProfileFromResponse(fullResponse);
    console.log("Profile from client response:", JSON.stringify(clientProfile));

    // Try to fetch profile from KingsChat API
    const apiProfile = await fetchKcProfile(accessToken, kcUserId);

    // Determine username and avatar from all available sources
    let kcUsername = "KingsChat User";
    let kcAvatar: string | null = null;

    // Priority: API profile > client response > JWT claims
    const sources = [apiProfile, clientProfile, fullResponse, jwtPayload].filter(Boolean);
    
    for (const source of sources) {
      const s = source?.data || source?.user || source;
      if (!s) continue;
      
      if (kcUsername === "KingsChat User") {
        kcUsername = s.username || s.display_name || s.displayName || s.name || 
                     s.full_name || s.fullName || s.firstName || s.first_name || kcUsername;
        
        if (s.firstName || s.first_name) {
          const first = s.firstName || s.first_name || "";
          const last = s.lastName || s.last_name || "";
          if (first) kcUsername = [first, last].filter(Boolean).join(" ");
        }
      }
      
      if (!kcAvatar) {
        kcAvatar = s.avatar || s.avatar_url || s.avatarUrl || s.profile_image || 
                   s.profileImage || s.photo || s.image || s.picture || s.photo_url || null;
      }
      
      if (kcUsername !== "KingsChat User" && kcAvatar) break;
    }

    // Final fallback for username
    if (kcUsername === "KingsChat User") {
      kcUsername = `KingsChat_${kcUserId.substring(0, 8)}`;
    }

    console.log(`Final profile - username: ${kcUsername}, avatar: ${kcAvatar}`);

    // Use Supabase service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const fakeEmail = `kc_${kcUserId}@kingschat.local`;
    const password = `kc_auth_${kcUserId}_${serviceKey.slice(-8)}`;

    // Try sign in first
    let { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({ email: fakeEmail, password });

    if (signInError) {
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

      const { data: newSignIn, error: newSignInError } =
        await supabase.auth.signInWithPassword({ email: fakeEmail, password });

      if (newSignInError) {
        return new Response(
          JSON.stringify({ error: "Failed to sign in", details: newSignInError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      signInData = newSignIn;
    }

    const userId = signInData.user!.id;

    // Update profile with latest KingsChat data
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
        kingschat_profile: { username: kcUsername, avatar_url: kcAvatar },
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
