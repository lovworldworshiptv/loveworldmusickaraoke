import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const KINGSCHAT_CLIENT_ID = "35769f15-f514-4838-83cd-a393dea6fa03";
const KC_TOKEN_URL = "https://connect.kingsch.at/developer/api/oauth2/token";
const KC_API = "https://connect.kingsch.at";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return atob(padded);
}

function parseReturnToken(value: string | null) {
  if (!value) return { nonce: "", appOrigin: "" };
  try {
    const parsed = JSON.parse(decodeBase64Url(value));
    if (parsed && typeof parsed.nonce === "string") {
      return {
        nonce: parsed.nonce,
        appOrigin: typeof parsed.appOrigin === "string" ? parsed.appOrigin : "",
      };
    }
  } catch { /* plain nonce fallback */ }
  return { nonce: value, appOrigin: "" };
}

function popupCompleteHtml(nonce: string, appOrigin: string) {
  const safeNonce = JSON.stringify(nonce);
  const safeOrigin = JSON.stringify(appOrigin || "*");
  const callbackUrl = appOrigin
    ? JSON.stringify(`${appOrigin}/auth/kingschat-callback?nonce=${encodeURIComponent(nonce)}`)
    : "null";

  return `<!doctype html><html><head><meta charset="utf-8"><title>Signing in…</title></head><body style="font-family:system-ui;background:#0b1020;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><div style="width:36px;height:36px;border:3px solid #f5c451;border-top-color:transparent;border-radius:50%;animation:s 1s linear infinite;margin:0 auto 12px"></div><p>Signed in. Returning to Loveworld Music Karaoke+…</p></div><style>@keyframes s{to{transform:rotate(360deg)}}</style><script>var n=${safeNonce};var o=${safeOrigin};var u=${callbackUrl};try{if(window.opener&&!window.opener.closed){window.opener.postMessage({type:"KC_AUTH_COMPLETE",nonce:n},o);}}catch(e){}function c(){try{window.close();}catch(e){}}c();setTimeout(c,300);setTimeout(function(){if(u){try{window.location.replace(u);}catch(e){}}},900);</script></body></html>`;
}

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
  let appOrigin = "";
  try {
    // KingsChat may POST as JSON, form-encoded, or as query params. Handle all.
    let code = "";
    const url = new URL(req.url);
    code = url.searchParams.get("code") || "";
    const applyReturnToken = (token: string | null) => {
      const parsed = parseReturnToken(token);
      if (!nonce && parsed.nonce) nonce = parsed.nonce;
      if (!appOrigin && parsed.appOrigin) appOrigin = parsed.appOrigin;
    };
    applyReturnToken(url.searchParams.get("origin"));
    applyReturnToken(url.searchParams.get("state"));
    applyReturnToken(url.searchParams.get("nonce"));

    if (req.method === "POST" || req.method === "PUT") {
      const ct = req.headers.get("content-type") || "";
      const raw = await req.text();
      if (raw) {
        if (ct.includes("application/json")) {
          try {
            const j = JSON.parse(raw);
            code = code || j.code || "";
            applyReturnToken(j.origin || null);
            applyReturnToken(j.state || null);
            applyReturnToken(j.nonce || null);
          } catch { /* fall through */ }
        }
        try {
          const params = new URLSearchParams(raw);
          code = code || params.get("code") || "";
          applyReturnToken(params.get("origin"));
          applyReturnToken(params.get("state"));
          applyReturnToken(params.get("nonce"));
        } catch { /* ignore */ }
      }
    }

    console.log(`KC callback: code=${code?.substring(0, 8)}... nonce=${nonce}`);

    if (!code) {
      return new Response(JSON.stringify({ error: "Missing code" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!nonce) throw new Error("Missing KingsChat return token");

    const wantsHtmlEarly = req.method === "GET"
      || (req.headers.get("accept") || "").includes("text/html")
      || req.headers.get("sec-fetch-dest") === "document";

    // Dedupe: KingsChat codes are single-use. If this nonce already completed,
    // just return the completion signal (browser/popup may hit this twice).
    const { data: existing } = await supabase
      .from("kingschat_auth_sessions")
      .select("session_data,error")
      .eq("nonce", nonce)
      .maybeSingle();
    if (existing?.session_data) {
      if (wantsHtmlEarly) {
        return new Response(popupCompleteHtml(nonce, appOrigin), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
        });
      }
      return new Response(JSON.stringify({ ok: true, duplicate: true }), {
        status: 200,
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
    const { error: sessionWriteError } = await supabase.from("kingschat_auth_sessions").upsert({
      nonce,
      session_data: {
        session: signInData!.session,
        kingschat_profile: { username: kcUsername, avatar_url: kcAvatar, handle: kcHandle },
      },
      error: null,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    });

    if (sessionWriteError) {
      console.error("KC session handoff write failed:", sessionWriteError.message);
      throw new Error("Could not complete KingsChat sign-in handoff");
    }

    const wantsHtml = req.method === "GET"
      || (req.headers.get("accept") || "").includes("text/html")
      || req.headers.get("sec-fetch-dest") === "document";

    if (wantsHtml) {
      return new Response(popupCompleteHtml(nonce, appOrigin), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("KC callback error:", err);
    if (nonce) {
      try {
        const { data: prior } = await supabase
          .from("kingschat_auth_sessions")
          .select("session_data")
          .eq("nonce", nonce)
          .maybeSingle();
        if (!prior?.session_data) {
          await supabase.from("kingschat_auth_sessions").upsert({
            nonce,
            error: err.message || "Internal error",
          });
        }
      } catch { /* ignore */ }
    }
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
