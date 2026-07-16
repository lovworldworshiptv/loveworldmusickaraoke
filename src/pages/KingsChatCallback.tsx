import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * OAuth redirect target for KingsChat.
 * KingsChat redirects here with ?code=...&state=<nonce>.
 * We forward {code, origin: nonce} to the kingschat-callback edge function
 * and close the popup. The opener polls kingschat-poll for the session.
 */
const KingsChatCallback = () => {
  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const nonce = params.get("state") || params.get("nonce") || "";
      const errorParam = params.get("error");

      try {
        if (errorParam) throw new Error(errorParam);
        if (!code && nonce) {
          window.opener?.postMessage({ type: "KC_AUTH_COMPLETE", nonce }, window.location.origin);
          return;
        }
        if (!code) throw new Error("Missing authorization code");
        await supabase.functions.invoke("kingschat-callback", {
          body: { code, origin: nonce },
        });
      } catch (e) {
        console.error("KC callback error", e);
      } finally {
        // Give the opener a moment to poll
        setTimeout(() => {
          try { window.close(); } catch {}
        }, 400);
      }
    };
    run();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6 text-center">
      <div>
        <div className="w-10 h-10 mx-auto mb-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-sm text-muted-foreground">Finishing KingsChat sign-in…</p>
        <p className="text-xs text-muted-foreground mt-1">You can close this window.</p>
      </div>
    </div>
  );
};

export default KingsChatCallback;
