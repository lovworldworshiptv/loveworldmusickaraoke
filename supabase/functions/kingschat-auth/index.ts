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

/**
 * Parse protobuf-like binary response from KingsChat API.
 * The response contains UTF-8 strings with length-prefixed fields.
 * We extract all readable strings and match them by pattern.
 */
function parseProtobufProfile(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const strings: string[] = [];
  
  // Extract length-prefixed strings from protobuf wire format
  let i = 0;
  while (i < bytes.length) {
    // Look for string fields (wire type 2 = length-delimited)
    const tag = bytes[i];
    const wireType = tag & 0x07;
    
    if (wireType === 2 && i + 1 < bytes.length) {
      const len = bytes[i + 1];
      if (len > 0 && len < 255 && i + 2 + len <= bytes.length) {
        try {
          const str = new TextDecoder().decode(bytes.slice(i + 2, i + 2 + len));
          // Check if it's a valid readable string
          if (str.length > 1 && /^[\x20-\x7E\u00A0-\uFFFF]+$/.test(str)) {
            strings.push(str);
          }
        } catch { /* skip */ }
      }
    }
    i++;
  }

  console.log("Protobuf extracted strings:", JSON.stringify(strings));

  let userId = "";
  let displayName = "";
  let username = "";
  let avatarUrl: string | null = null;
  let bio = "";

  for (const s of strings) {
    if (/^https?:\/\/cdn/.test(s)) {
      avatarUrl = s;
    } else if (/^[a-f0-9]{24}$/.test(s)) {
      userId = s;
    } else if (!displayName && s.length > 2 && s.includes(" ") && !s.includes("|") && !s.includes("/")) {
      displayName = s;
    } else if (!username && /^[a-zA-Z0-9_]{2,30}$/.test(s) && s !== userId) {
      username = s;
    } else if (s.includes("|")) {
      bio = s;
    }
  }

  return { userId, displayName, username, avatarUrl, bio };
}

async function fetchKcProfileProtobuf(accessToken: string, userId: string) {
  const url = `${KC_API}/api/users/${userId}`;
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "*/*",
      },
    });

    console.log(`KC protobuf endpoint ${url} -> ${res.status}`);

    if (res.ok) {
      const buffer = await res.arrayBuffer();
      const profile = parseProtobufProfile(buffer);
      console.log("Parsed protobuf profile:", JSON.stringify(profile));
      return profile;
    } else {
      const text = await res.text();
      console.log(`KC protobuf error: ${text.substring(0, 200)}`);
    }
  } catch (e: any) {
    console.log(`KC protobuf fetch error: ${e.message}`);
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { accessToken } = body;
    
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Missing accessToken" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Decode JWT to extract user ID
    const jwtPayload = decodeJwtPayload(accessToken);
    const kcUserId = jwtPayload?.sub || "";
    if (!kcUserId) {
      return new Response(
        JSON.stringify({ error: "Invalid KingsChat token - no sub claim" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`KingsChat auth for user: ${kcUserId}`);

    // Fetch profile from protobuf endpoint (the only one that works)
    const profile = await fetchKcProfileProtobuf(accessToken, kcUserId);

    const kcUsername = profile?.displayName || profile?.username || `KingsChat_${kcUserId.substring(0, 8)}`;
    const kcAvatar = profile?.avatarUrl || null;
    const kcHandle = profile?.username || null;

    console.log(`Final profile - username: ${kcUsername}, handle: ${kcHandle}, avatar: ${kcAvatar}`);

    // Use Supabase service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Use kingschat handle/username for a readable email, fallback to userId
    const emailHandle = (kcHandle || profile?.username || "").toLowerCase().replace(/[^a-z0-9_]/g, "");
    const newEmail = emailHandle ? `${emailHandle}@kingschat.online` : `kc_${kcUserId}@kingschat.online`;
    const oldEmail = `kc_${kcUserId}@kingschat.local`;
    const password = `kc_auth_${kcUserId}_${serviceKey.slice(-8)}`;

    console.log(`Auth emails - new: ${newEmail}, old: ${oldEmail}`);

    // Try sign in with new email first
    let { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({ email: newEmail, password });

    // If new email fails, try old email (migration case)
    if (signInError) {
      const { data: oldSignIn, error: oldError } =
        await supabase.auth.signInWithPassword({ email: oldEmail, password });

      if (!oldError && oldSignIn?.user) {
        // Migrate: update email from old to new format
        console.log(`Migrating user ${oldSignIn.user.id} email from ${oldEmail} to ${newEmail}`);
        await supabase.auth.admin.updateUserById(oldSignIn.user.id, { email: newEmail });
        signInData = oldSignIn;
        signInError = null;
      }
    }

    // If still no user, create new account
    if (signInError) {
      const { data: signUpData, error: signUpError } = await supabase.auth.admin.createUser({
        email: newEmail,
        password,
        email_confirm: true,
        user_metadata: {
          username: kcUsername,
          avatar_url: kcAvatar,
          provider: "kingschat",
          kingschat_id: kcUserId,
          kingschat_handle: kcHandle,
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
        await supabase.auth.signInWithPassword({ email: newEmail, password });

      if (newSignInError) {
        return new Response(
          JSON.stringify({ error: "Failed to sign in", details: newSignInError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      signInData = newSignIn;
    }

    const userId = signInData.user!.id;

    // Update user metadata with latest KingsChat profile
    await supabase.auth.admin.updateUserById(userId, {
      user_metadata: {
        username: kcUsername,
        avatar_url: kcAvatar,
        provider: "kingschat",
        kingschat_id: kcUserId,
        kingschat_handle: kcHandle,
      },
    });

    // Update profile table
    await supabase
      .from("profiles")
      .update({
        username: kcUsername,
        avatar_url: kcAvatar,
        kingschat_handle: kcHandle,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    return new Response(
      JSON.stringify({
        session: signInData.session,
        user: signInData.user,
        kingschat_profile: { username: kcUsername, avatar_url: kcAvatar, handle: kcHandle },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("KingsChat auth error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
