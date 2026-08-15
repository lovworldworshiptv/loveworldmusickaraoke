declare global {
  interface Window {
    AndroidKingsChat?: {
      login: (origin: string) => void;
    };
  }
}

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

const currentPlatform = (): "web" | "android" =>
  typeof window.AndroidKingsChat?.login === "function"
    ? "android"
    : "web";

export function startKingsChatLogin(
  next = "/"
) {

  window.location.href =
    `${FUNCTIONS_BASE}/kingschat-login` +
    `?platform=${currentPlatform()}` +
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

async function createLoginAttempt(
  next: string
): Promise<LoginStart> {

  const platform =
    currentPlatform();

  const res = await fetch(
    `${FUNCTIONS_BASE}/kingschat-login` +
    `?format=json` +
    `&platform=${platform}` +
    `&next=${encodeURIComponent(
      safePath(next)
    )}`,
    {
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
      },
    }
  );

  const json = await res.json();

  if (!res.ok || !json?.url) {
    throw new Error(
      json?.error ||
      "Could not start KingsChat sign-in"
    );
  }

  return json as LoginStart;
}

async function poll(
  origin: string
) {

  const res = await fetch(
    `${FUNCTIONS_BASE}/kingschat-poll` +
    `?nonce=${encodeURIComponent(origin)}`,
    {
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
      },
    }
  );

  return res.json();
}

export interface KingsChatLoginResult {
  redirectPath: string;
  username?: string;
}

export async function signInWithKingsChat(
  next = "/"
): Promise<KingsChatLoginResult> {

  const nativeBridge =
    window.AndroidKingsChat;

  // ---------------------------------------------------------
  // ANDROID NATIVE SDK FLOW
  // ---------------------------------------------------------

  if (
    typeof nativeBridge?.login ===
    "function"
  ) {

    const start =
      await createLoginAttempt(next);

    return new Promise(
      (resolve, reject) => {

        let settled = false;

        const cleanup = () => {

          window.removeEventListener(
            "kingschatNativeResult",
            onNativeResult as EventListener
          );
        };

        const fail = (
          message: string
        ) => {

          if (settled) return;

          settled = true;

          cleanup();

          reject(
            new Error(message)
          );
        };

        const onNativeResult =
          (event: Event) => {

            const detail =
              (event as CustomEvent)
                .detail || {};

            if (
              detail.origin !==
              start.origin
            ) {
              return;
            }

            if (
              detail.status ===
              "cancel"
            ) {

              fail(
                "KingsChat sign-in cancelled"
              );

            } else if (
              detail.status ===
              "error"
            ) {

              fail(
                detail.message ||
                "KingsChat sign-in failed"
              );
            }
          };

        window.addEventListener(
          "kingschatNativeResult",
          onNativeResult as EventListener
        );

        try {

          // Android now starts the native
          // SDK directly.
          nativeBridge.login(
            start.origin
          );

        } catch (e: any) {

          fail(
            e?.message ||
            "Could not start native KingsChat sign-in"
          );

          return;
        }

        const deadline =
          Date.now() +
          5 * 60 * 1000;

        const pollNative =
          async () => {

            while (
              !settled &&
              Date.now() < deadline
            ) {

              await new Promise(
                r => setTimeout(r, 1000)
              );

              let result: any;

              try {

                result =
                  await poll(
                    start.origin
                  );

              } catch {

                continue;
              }

              if (
                result?.status ===
                  "ready" &&
                result?.session
              ) {

                settled = true;

                cleanup();

                const {
                  error
                } =
                  await supabase.auth.setSession(
                    {
                      access_token:
                        result.session
                          .access_token,

                      refresh_token:
                        result.session
                          .refresh_token,
                    }
                  );

                if (error) {

                  reject(error);

                  return;
                }

                resolve({
                  redirectPath:
                    safePath(
                      result.redirect_path ||
                      start.redirect_path
                    ),

                  username:
                    result
                      .kingschat_profile
                      ?.username,
                });

                return;
              }

              if (
                result?.status ===
                "error"
              ) {

                fail(
                  result.error ||
                  "KingsChat sign-in failed"
                );

                return;
              }

              if (
                result?.status ===
                "expired"
              ) {

                fail(
                  "KingsChat sign-in expired, please try again"
                );

                return;
              }
            }

            if (!settled) {

              fail(
                "KingsChat sign-in timed out"
              );
            }
          };

        void pollNative();
      }
    );
  }

  // ---------------------------------------------------------
  // NORMAL WEB FLOW
  // ---------------------------------------------------------

  const popup =
    window.open(
      "",
      "kingschat-login",
      "width=480,height=720"
    );

  if (!popup) {

    throw new Error(
      "Popup blocked — please allow popups and try again"
    );
  }

  let start: LoginStart;

  try {

    start =
      await createLoginAttempt(next);

  } catch (e) {

    popup.close();

    throw e;
  }

  popup.location.href =
    start.url;

  const deadline =
    Date.now() +
    5 * 60 * 1000;

  while (
    Date.now() < deadline
  ) {

    await new Promise(
      r => setTimeout(r, 1500)
    );

    let result: any;

    try {

      result =
        await poll(
          start.origin
        );

    } catch {

      continue;
    }

    if (
      result?.status ===
        "ready" &&
      result?.session
    ) {

      try {
        popup.close();
      } catch {}

      const {
        error
      } =
        await supabase.auth.setSession(
          {
            access_token:
              result.session
                .access_token,

            refresh_token:
              result.session
                .refresh_token,
          }
        );

      if (error)
        throw error;

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

    if (
      result?.status ===
      "error"
    ) {

      try {
        popup.close();
      } catch {}

      throw new Error(
        result.error ||
        "KingsChat sign-in failed"
      );
    }

    if (
      result?.status ===
      "expired"
    ) {

      try {
        popup.close();
      } catch {}

      throw new Error(
        "KingsChat sign-in expired, please try again"
      );
    }
  }

  try {
    popup.close();
  } catch {}

  throw new Error(
    "KingsChat sign-in timed out"
  );
}

export async function ensureKingsChatToken() {

  const {
    data,
    error
  } =
    await supabase.functions.invoke(
      "kingschat-refresh",
      {
        method: "POST"
      }
    );

  if (error)
    throw error;

  return data as {
    refreshed: boolean;
    expires_at: string;
  };
}
