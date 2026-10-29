import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import MusicBackground from "@/components/auth/MusicBackground";
import ResendConfirmation from "@/components/auth/ResendConfirmation";
import logoFull from "@/assets/logo-mic-heart.png";
import { parseConfirmLink, type ConfirmLink } from "@/lib/emailLink";
import { markRemembered } from "@/lib/rememberMe";

type Stage = "checking" | "tap" | "verifying" | "expired";

/** Landing page for the "confirm your email" link sent after sign-up. */
const ConfirmEmail = () => {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("checking");
  const link = useRef<ConfirmLink>({ kind: "none" });
  const finished = useRef(false);

  const finish = (name?: string | null) => {
    if (finished.current) return;
    finished.current = true;
    markRemembered();
    // A confirmed member goes straight in; the welcome slides are for first-time visitors.
    localStorage.setItem("onboarding_completed", "true");
    toast.success(name ? `Welcome Esteemed ${name}! Your account is ready.` : "Your email is confirmed. Welcome!");
    navigate("/", { replace: true });
  };

  // Only call a link expired when no session exists after all.
  const settle = async (error: unknown) => {
    const { data } = await supabase.auth.getSession();
    if (data.session) return finish(data.session.user.user_metadata?.username);
    if (error) setStage("expired");
    else setStage("expired");
  };

  useEffect(() => {
    link.current = parseConfirmLink(window.location.search, window.location.hash);
    if (link.current.kind !== "none") window.history.replaceState(null, "", "/auth/confirm");

    const run = async () => {
      const l = link.current;
      if (l.kind === "token_hash") return setStage("tap");
      if (l.kind === "tokens") {
        const { error } = await supabase.auth.setSession({ access_token: l.accessToken, refresh_token: l.refreshToken });
        return settle(error);
      }
      if (l.kind === "code") {
        const { error } = await supabase.auth.exchangeCodeForSession(l.code);
        return settle(error);
      }
      return settle(l.kind === "error" ? true : null);
    };
    run().catch(() => setStage("expired"));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const confirm = async () => {
    const l = link.current;
    if (l.kind !== "token_hash") return;
    setStage("verifying");
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: l.tokenHash, type: l.type });
    if (!error && data.session) return finish(data.session.user.user_metadata?.username);
    settle(error);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
      <MusicBackground />
      <div className="w-full max-w-md glass-card p-8 text-center">
        <img src={logoFull} alt="Loveworld Music+ logo" className="mx-auto mb-4 h-20 w-20 rounded-[22px] object-contain shadow-[0_6px_28px_hsl(43_70%_53%/0.4)]" />
        <h1 className="text-2xl font-serif gradient-gold-text font-bold mb-2">Confirm your email</h1>

        {stage === "checking" && <p className="text-sm text-muted-foreground">Checking your link…</p>}

        {(stage === "tap" || stage === "verifying") && (
          <>
            <p className="text-sm text-muted-foreground mb-6">One last step — tap below to confirm your email and finish creating your account.</p>
            <button
              onClick={confirm}
              disabled={stage === "verifying"}
              className="w-full py-3 rounded-lg gradient-gold text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {stage === "verifying" ? "Confirming…" : "Confirm my email"}
            </button>
          </>
        )}

        {stage === "expired" && (
          <>
            <p className="text-sm text-muted-foreground mb-6">
              This link has expired or was already used. If you signed up more than once, only the newest email works. Enter your email to get a fresh link — or sign in if you've already confirmed.
            </p>
            <ResendConfirmation askEmail />
            <button onClick={() => navigate("/auth", { replace: true })} className="w-full mt-3 py-3 rounded-lg gradient-gold text-primary-foreground font-semibold hover:opacity-90">
              Sign In
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ConfirmEmail;
