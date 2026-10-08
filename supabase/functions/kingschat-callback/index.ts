import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  corsHeaders,
  decodeJwtPayload,
  exchangeCode,
  expiryFromTokens,
  fetchKcProfile,
  normalizePlatform,
} from "../_shared/kingschat.ts";

// POST /kingschat-callback
// { code, origin }
//
// Server-to-server callback from KingsChat.
//
// Validates the CSRF token issued by kingschat-login,
// exchanges the authorization code immediately,
// stores the OAuth tokens,
// and stages an app session for the waiting browser tab.

function closeHtml(message: string) {

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>KingsChat</title>
      </head>

      <body
        style="
          font-family:system-ui;
          background:#0b1020;
          color:#fff;
          display:flex;
          align-items:center;
          justify-content:center;
          height:100vh;
          margin:0
        "
      >

        <div style="text-align:center">

          <p>${message}</p>

          <p
            style="
              opacity:.6;
              font-size:13px
            "
          >
            You can close this window.
          </p>

        </div>

        <script>
          setTimeout(function() {
            try {
              window.close();
            } catch(e) {}
          }, 400);
        </script>

      </body>
    </html>
  `;
}

Deno.serve(async (req) => {

  if (req.method === "OPTIONS") {

    return new Response(
      null,
      {
        headers: corsHeaders
      }
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  const wantsHtml =
    req.method === "GET" ||
    (req.headers.get("accept") || "")
      .includes("text/html") ||
    req.headers.get("sec-fetch-dest") === "document";

  let origin = "";

  try {

    const url =
      new URL(req.url);

    let code =
      url.searchParams.get("code") || "";

    origin =
      url.searchParams.get("origin") ||
      url.searchParams.get("state") ||
      "";

    if (
      req.method === "POST" ||
      req.method === "PUT"
    ) {

      const raw =
        await req.text();

      if (raw) {

        try {

          const j =
            JSON.parse(raw);

          code =
            code ||
            j.code ||
            "";

          origin =
            origin ||
            j.origin ||
            j.state ||
            "";

        } catch {

          const params =
            new URLSearchParams(raw);

          code =
            code ||
            params.get("code") ||
            "";

          origin =
            origin ||
            params.get("origin") ||
            params.get("state") ||
            "";
        }
      }
    }

    if (!code) {
      throw new Error(
        "Missing authorization code"
      );
    }

    if (!origin) {
      throw new Error(
        "Missing origin token"
      );
    }

    // -----------------------------------------------------------
    // Validate CSRF token
    // -----------------------------------------------------------

    const {
      data: attempt
    } = await supabase
      .from("kingschat_auth_sessions")
      .select(
        "nonce, redirect_path, expires_at, session_data, platform"
      )
      .eq("nonce", origin)
      .maybeSingle();

    if (!attempt) {

      throw new Error(
        "Unknown or expired origin token"
      );
    }

    if (
      new Date(attempt.expires_at) <
      new Date()
    ) {

      throw new Error(
        "Sign-in attempt expired"
      );
    }

    const doneResponse = () =>
      wantsHtml

        ? new Response(
            closeHtml("Signed in."),
            {
              headers: {
                ...corsHeaders,
                "Content-Type":
                  "text/html; charset=utf-8"
              }
            }
          )

        : new Response(
            JSON.stringify({
              ok: true,
              duplicate: true
            }),
            {
              headers: {
                ...corsHeaders,
                "Content-Type":
                  "application/json"
              }
            }
          );

    // -----------------------------------------------------------
    // Duplicate delivery
    // -----------------------------------------------------------

    if (attempt.session_data) {

      return doneResponse();
    }

    // -----------------------------------------------------------
    // Single-flight claim
    // -----------------------------------------------------------

    const {
      data: claimed
    } = await supabase
      .from("kingschat_auth_sessions")
      .update({
        code_claimed_at:
          new Date().toISOString()
      })
      .eq("nonce", origin)
      .is("code_claimed_at", null)
      .select("nonce")
      .maybeSingle();

    if (!claimed) {

      for (
        let i = 0;
        i < 20;
        i++
      ) {

        await new Promise(
          (r) =>
            setTimeout(r, 500)
        );

        const {
          data: row
        } = await supabase
          .from("kingschat_auth_sessions")
          .select(
            "session_data, error"
          )
          .eq("nonce", origin)
          .maybeSingle();

        if (row?.session_data) {

          return doneResponse();
        }

        if (row?.error) {

          throw new Error(
            row.error
          );
        }

        if (!row) {

          return doneResponse();
        }
      }

      return doneResponse();
    }

    // -----------------------------------------------------------
    // Exchange authorization code
    // -----------------------------------------------------------

    const tokens =
      await exchangeCode(
        code,
        normalizePlatform(
          (attempt as any).platform
        )
      );

    // -----------------------------------------------------------
    // Extract KingsChat user ID
    // -----------------------------------------------------------

    const kcUserId =
      decodeJwtPayload(
        tokens.access_token
      )?.sub || "";

    if (!kcUserId) {

      throw new Error(
        "No subject in KingsChat access token"
      );
    }

    // -----------------------------------------------------------
    // Fetch KingsChat profile
    // -----------------------------------------------------------

    const profile =
      await fetchKcProfile(
        tokens.access_token,
        kcUserId
      );

    const kcUsername =
      profile?.displayName ||
      profile?.username ||
      `KingsChat_${kcUserId.slice(0, 8)}`;

    const kcAvatar =
      profile?.avatarUrl ||
      null;

    const kcHandle =
      profile?.username ||
      null;

    // -----------------------------------------------------------
    // Create deterministic Supabase account
    // -----------------------------------------------------------

    const serviceKey =
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY"
      )!;

    const emailHandle =
      (kcHandle || "")
        .toLowerCase()
        .replace(
          /[^a-z0-9_]/g,
          ""
        );

    const email =
      emailHandle
        ? `${emailHandle}@kingschat.online`
        : `kc_${kcUserId}@kingschat.online`;

    const password =
      `kc_auth_${kcUserId}_${serviceKey.slice(-8)}`;

    const metadata = {

      username: kcUsername,

      avatar_url: kcAvatar,

      provider: "kingschat",

      kingschat_id: kcUserId,

      kingschat_handle: kcHandle,
    };

    // -----------------------------------------------------------
    // Separate auth client
    //
    // IMPORTANT:
    //
    // signInWithPassword mutates auth state.
    // Do not reuse the service-role client.
    // -----------------------------------------------------------

    const authClient =
      createClient(
        Deno.env.get(
          "SUPABASE_URL"
        )!,

        Deno.env.get(
          "SUPABASE_SERVICE_ROLE_KEY"
        )!,

        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );

    let {
      data: signInData,
      error: signInError
    } =
      await authClient.auth
        .signInWithPassword({
          email,
          password
        });

    // -----------------------------------------------------------
    // Create user if necessary
    // -----------------------------------------------------------

    if (signInError) {

      const {
        error: createError
      } =
        await supabase.auth.admin
          .createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: metadata
          });

      if (createError) {

        throw createError;
      }

      const retry =
        await authClient.auth
          .signInWithPassword({
            email,
            password
          });

      if (retry.error) {

        throw retry.error;
      }

      signInData =
        retry.data;
    }

    // -----------------------------------------------------------
    // Update user metadata
    // -----------------------------------------------------------

    const userId =
      signInData!.user!.id;

    await supabase.auth.admin
      .updateUserById(
        userId,
        {
          user_metadata:
            metadata
        }
      );

    // -----------------------------------------------------------
    // Update profile
    // -----------------------------------------------------------

    // Never wipe an existing avatar when the profile fetch fails or returns none.
    await supabase
      .from("profiles")
      .update({
        username: kcUsername,
        ...(kcAvatar ? { avatar_url: kcAvatar } : {}),
        kingschat_handle: kcHandle,
        updated_at:
          new Date().toISOString()
      })
      .eq(
        "user_id",
        userId
      );

    // -----------------------------------------------------------
    // Store KingsChat OAuth tokens
    // -----------------------------------------------------------

    await supabase
      .from("kingschat_oauth_tokens")
      .upsert(
        {
          user_id: userId,

          kingschat_user_id:
            kcUserId,

          access_token:
            tokens.access_token,

          refresh_token:
            tokens.refresh_token ??
            null,

          expires_at:
            expiryFromTokens(
              tokens
            ),

          updated_at:
            new Date().toISOString()
        },
        {
          onConflict:
            "user_id"
        }
      );

    // -----------------------------------------------------------
    // Stage Supabase session for browser
    // -----------------------------------------------------------

    const {
      error: handoffError
    } =
      await supabase
        .from(
          "kingschat_auth_sessions"
        )
        .update({
          session_data: {

            session:
              signInData!.session,

            redirect_path:
              attempt.redirect_path ||
              "/",

            kingschat_profile: {

              username:
                kcUsername,

              avatar_url:
                kcAvatar,

              handle:
                kcHandle
            }
          },

          error: null,

          expires_at:
            new Date(
              Date.now() +
              5 * 60 * 1000
            ).toISOString()
        })
        .eq(
          "nonce",
          origin
        );

    if (handoffError) {

      console.error(
        "KC handoff update failed:",
        JSON.stringify(
          handoffError
        )
      );

      throw new Error(
        `Could not complete KingsChat sign-in handoff: ${handoffError.message}`
      );
    }

    // -----------------------------------------------------------
    // Success
    // -----------------------------------------------------------

    return wantsHtml

      ? new Response(
          closeHtml(
            "Signed in. Returning to Loveworld Music Karaoke+…"
          ),
          {
            headers: {
              ...corsHeaders,
              "Content-Type":
                "text/html; charset=utf-8"
            }
          }
        )

      : new Response(
          JSON.stringify({
            ok: true
          }),
          {
            headers: {
              ...corsHeaders,
              "Content-Type":
                "application/json"
            }
          }
        );

  } catch (err: any) {

    console.error(
      "KC callback error:",
      err
    );

    if (origin) {

      try {

        await supabase
          .from(
            "kingschat_auth_sessions"
          )
          .update({
            error:
              err.message ||
              "Internal error"
          })
          .eq(
            "nonce",
            origin
          )
          .is(
            "session_data",
            null
          );

      } catch {
        // Ignore.
      }
    }

    return wantsHtml

      ? new Response(
          closeHtml(
            "KingsChat sign-in failed."
          ),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              "Content-Type":
                "text/html; charset=utf-8"
            }
          }
        )

      : new Response(
          JSON.stringify({
            error:
              err.message ||
              "Internal error"
          }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              "Content-Type":
                "application/json"
            }
          }
        );
  }
});
