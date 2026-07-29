import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { startKingsChatLogin } from "@/lib/kingschat";

/**
 * GET /auth/kingschat/login — full-page entry point.
 * Redirects the browser to the KingsChat hosted login page via the
 * kingschat-login edge function (which issues the server-side CSRF token).
 */
const KingsChatLogin = () => {
  const location = useLocation();

  useEffect(() => {
    const next = new URLSearchParams(location.search).get("next") || "/";
    startKingsChatLogin(next);
  }, [location.search]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6 text-center">
      <div>
        <div className="w-10 h-10 mx-auto mb-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-sm text-muted-foreground">Redirecting to KingsChat…</p>
      </div>
    </div>
  );
};

export default KingsChatLogin;
