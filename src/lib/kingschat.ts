import { supabase } from "@/integrations/supabase/client";

const FUNCTIONS_BASE =
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

const ANON_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const safePath = (
  value: string | null | undefined
) =>
  value &&
  value.startsWith("/") &&
  !value.startsWith("//")
    ? value
    : "/";

/**
 * Start KingsChat browser OAuth.
 *
 * IMPORTANT:
 *
 * This intentionally does NOT detect Android.
 * It always uses the WEB KingsChat client configuration.
 *
 * The Android application is simply a browser wrapper around
 * the normal web authentication flow.
 */
export function startKingsChatLogin(
  next = "/"
) {
  window.location.href =
    `${FUNCTIONS_BASE}/kingschat-login` +
    `?platform=web` +
    `&next=${encodeURIComponent(
      safePath(next)
    )}`;
}

interface LoginStart {
  url: string;
  origin: string;
  redirect_path: string;
  platform?: string;
}

/**
 * Creates a server-side KingsChat login attempt.
 *
 * Always requests the WEB platform.
 */
async function createLoginAttempt(
  next: string
): Promise<LoginStart> {

  const res = await fetch(
    `${FUNCTIONS_BASE}/kingschat-login` +
      `?format=json` +
      `&platform=web` +
      `&next=${encodeURIComponent(
        safePath(next)
      )}`,
    {
      headers: {
        apikey: ANON_KEY,
        Authorization:
          `Bearer ${ANON_KEY}`,
      },
    }
  );

  const json = await res.json();

  if (
    !res.ok ||
    !json?.url
  ) {
    throw new Error(
      json?.error ||
      "Could not start KingsChat sign-in"
    );
  }

  return json as LoginStart;
}

/**
 * Polls the server-side login session.
 *
 * The browser itself never receives the KingsChat access token.
 * The server performs the OAuth exchange and stages the
 * Supabase session.
 */
async function poll(
  origin: string
) {

  const res = await fetch(
    `${FUNCTIONS_BASE}/kingschat-poll` +
      `?nonce=${encodeURIComponent(origin)}`,
    {
      headers: {
        apikey: ANON_KEY,
        Authorization:
          `Bearer ${ANON_KEY}`,
      },
    }
  );

  return res.json();
}

export interface KingsChatLoginResult {
  redirectPath: string;
  username?: string;
}

/**
 * KingsChat browser OAuth.
 *
 * This is the ONLY KingsChat authentication flow.
 *
 * There is no native Android SDK branch.
 * There is no AndroidKingsChat bridge.
 * There is no Android client ID.
 *
 * Both:
 *
 * 1. Normal web browsers
 * 2. Android WebView wrapper
 *
 * use the same WEB KingsChat OAuth client.
 */
export async function signInWithKingsChat(
  next = "/"
): Promise<KingsChatLoginResult> {

  // -------------------------------------------------------------
  // Open the KingsChat browser login window.
  // -------------------------------------------------------------

  const popup = window.open(
    "",
    "kingschat-login",
    "width=480,height=720"
  );

  if (!popup) {
    throw new Error(
      "Popup blocked — please allow popups and try again"
    );
  }

  // -------------------------------------------------------------
  // Create server-side login attempt.
  // -------------------------------------------------------------

  let start: LoginStart;

  try {

    start =
      await createLoginAttempt(next);

  } catch (e) {

    popup.close();

    throw e;
  }

  // -------------------------------------------------------------
  // Send popup to KingsChat web OAuth.
  // -------------------------------------------------------------

  popup.location.href =
    start.url;

  // -------------------------------------------------------------
  // Wait for backend authentication.
  // -------------------------------------------------------------

  const deadline =
    Date.now() +
    5 * 60 * 1000;

  while (
    Date.now() < deadline
  ) {

    await new Promise(
      (resolve) =>
        setTimeout(resolve, 1500)
    );

    let result: any;

    try {

      result =
        await poll(start.origin);

    } catch {

      continue;
    }

    // -----------------------------------------------------------
    // Successful login
    // -----------------------------------------------------------

    if (
      result?.status === "ready" &&
      result?.session
    ) {

      try {
        popup.close();
      } catch {
        // Ignore popup close errors.
      }

      const {
        error
      } =
        await supabase.auth.setSession({
          access_token:
            result.session.access_token,

          refresh_token:
            result.session.refresh_token,
        });

      if (error) {
        throw error;
      }

      return {

        redirectPath:
          safePath(
            result.redirect_path ||
            start.redirect_path
          ),

        username:
          result
            .kingschat_profile
            ?.username,
      };
    }

    // -----------------------------------------------------------
    // Backend authentication error
    // -----------------------------------------------------------

    if (
      result?.status === "error"
    ) {

      try {
        popup.close();
      } catch {
        // Ignore.
      }

      throw new Error(
        result.error ||
        "KingsChat sign-in failed"
      );
    }

    // -----------------------------------------------------------
    // Login attempt expired
    // -----------------------------------------------------------

    if (
      result?.status === "expired"
    ) {

      try {
        popup.close();
      } catch {
        // Ignore.
      }

      throw new Error(
        "KingsChat sign-in expired, please try again"
      );
    }
  }

  // -------------------------------------------------------------
  // Timeout
  // -------------------------------------------------------------

  try {
    popup.close();
  } catch {
    // Ignore.
  }

  throw new Error(
    "KingsChat sign-in timed out"
  );
}

/**
 * Ensures the stored KingsChat access token is still valid.
 */
export async function ensureKingsChatToken() {

  const {
    data,
    error
  } = await supabase.functions.invoke(
    "kingschat-refresh",
    {
      method: "POST",
    }
  );

  if (error) {
    throw error;
  }

  return data as {
    refreshed: boolean;
    expires_at: string;
  };
}
