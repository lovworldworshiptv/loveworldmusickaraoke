import { useEffect } from "react";

/**
 * Browser-visible landing page for /auth/kingschat/callback.
 *
 * The real KingsChat callback is a server-to-server POST handled by the
 * `kingschat-callback` edge function. If a browser ever lands here, we simply
 * tell the user it's done and close the popup — the opener tab is polling for
 * the session.
 */
const KingsChatCallback = () => {
  useEffect(() => {
    const t = setTimeout(() => {
      try { window.close(); } catch { /* ignore */ }
    }, 600);
    return () => clearTimeout(t);
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
