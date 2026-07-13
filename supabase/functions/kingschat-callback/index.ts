import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const KINGSCHAT_CLIENT_ID = "0d2afe44-0f0b-41f6-b2ff-3ee91706f0c8";
const KC_TOKEN_URL = "https://connect.kingsch.at/developer/api/oauth2/token";
const KC_API = "https://connect.kingsch.at";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

function parseProtobufProfile(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const strings: string[] = [];
  let i = 0;
  while (i < bytes.length) {
    const tag = bytes[i];
    const wireType = tag & 0x07;
    if (wireType === 2 && i + 1 < bytes.length) {
      const len = bytes[i + 1];
      if (len > 0 && len < 255 && i + 2 + len <= bytes.length) {
        try {
          const str = new TextDecoder().decode(bytes.slice(i + 2, i + 2 + len));
          if (str.length > 1 && /^[\x20-\x7E\u00A0-\uFFFF]+$/.test(str)) {
            strings.push(str);
          }
        } catch { /* skip */ }
      }
    }
    i++;
  }
  let userId = "", displayName = "", username = "", bio = "";
  let avatarUrl: string | null = null;
  for (const s of strings) {
    if (/^https?:\/\/cdn/.test(s)) avatarUrl = s;
    else if (/^[a-f0-9]{24}$/.test(s)) userId = s;
    else if (!displayName && s.length > 2 && s.includes(" ") && !s.includes("|") && !s.includes("/")) displayName = s;
    else if (!username && /^[a-zA-Z0-9_]{2,30}$/.test(s) && s !== userId) username = s;
    else if (s.includes("|")) bio = s;
  }
  return { userId, displayName, username, avatarUrl, bio };
}

async function fetchKcProfile(accessToken: string, userId: string) {
  try {
    const res = await fetch(`${KC_API}/api/users/${userId}`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "*/*" },
    });
    if (res.ok) return parseProtobufProfile(await res.arrayBuffer());
  } catch (e) {
    console.log("KC profile fetch error:", (e as Error).message);
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let nonce = "";
  try {
    const body = await req.json();
    const code = body.code;
    nonce = body.origin || "";

    console.log(`KC callback: code=${code?.substring(0, 8)}... nonce=${nonce}`);

    if (!code) {
      return new Response(JSON.stringify({ error: "Missing code" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Exchange code for tokens
    const tokenRes = await fetch(KC_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "code",
        client_id: KINGSCHAT_CLIENT_ID,
        code,
      }),
    });

    const tokenText = await tokenRes.text();
    if (!tokenRes.ok) {
      console.error("KC token exchange failed:", tokenRes.status, tokenText);
      if (nonce) {
        await supabase.from("kingschat_auth_sessions").upsert({
          nonce,
          error: `Token exchange failed: ${tokenText.substring(0, 200)}`,
        });
      }
      return new Response(JSON.stringify({ error: "Token exchange failed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tokens = JSON.parse(tokenText);
    const accessToken = tokens.access_token;
    const jwtPayload = decodeJwtPayload(accessToken);
    const kcUserId = jwtPayload?.sub || "";

    if (!kcUserId) throw new Error("No sub in KC access token");

    const profile = await fetchKcProfile(accessToken, kcUserId);
    const kcUsername = profile?.displayName || profile?.username || `KingsChat_${kcUserId.substring(0, 8)}`;
    const kcAvatar = profile?.avatarUrl || null;
    const kcHandle = profile?.username || null;

    const emailHandle = (kcHandle || "").toLowerCase().replace(/[^a-z0-9_]/g, "");
    const newEmail = emailHandle ? `${emailHandle}@kingschat.online` : `kc_${kcUserId}@kingschat.online`;
    const oldEmail = `kc_${kcUserId}@kingschat.local`;
    const password = `kc_auth_${kcUserId}_${serviceKey.slice(-8)}`;

    let { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({ email: newEmail, password });

    if (signInError) {
      const { data: oldSignIn, error: oldError } =
        await supabase.auth.signInWithPassword({ email: oldEmail, password });
      if (!oldError && oldSignIn?.user) {
        await supabase.auth.admin.updateUserById(oldSignIn.user.id, { email: newEmail });
        signInData = oldSignIn;
        signInError = null;
      }
    }

    if (signInError) {
      const { error: createError } = await supabase.auth.admin.createUser({
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
      if (createError) throw createError;
      const { data: newSignIn, error: newSignInError } =
        await supabase.auth.signInWithPassword({ email: newEmail, password });
      if (newSignInError) throw newSignInError;
      signInData = newSignIn;
    }

    const userId = signInData!.user!.id;
    await supabase.auth.admin.updateUserById(userId, {
      user_metadata: {
        username: kcUsername,
        avatar_url: kcAvatar,
        provider: "kingschat",
        kingschat_id: kcUserId,
        kingschat_handle: kcHandle,
      },
    });
    await supabase.from("profiles").update({
      username: kcUsername,
      avatar_url: kcAvatar,
      kingschat_handle: kcHandle,
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId);

    // Stash session for browser to pick up
    if (nonce) {
      await supabase.from("kingschat_auth_sessions").upsert({
        nonce,
        session_data: {
          session: signInData!.session,
          kingschat_profile: { username: kcUsername, avatar_url: kcAvatar, handle: kcHandle },
        },
        error: null,
      });
    }

    // KingsChat expects a 200 OK response
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("KC callback error:", err);
    if (nonce) {
      try {
        await supabase.from("kingschat_auth_sessions").upsert({
          nonce,
          error: err.message || "Internal error",
        });
      } catch { /* ignore */ }
    }
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
