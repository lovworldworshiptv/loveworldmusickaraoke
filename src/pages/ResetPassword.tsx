import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import MusicBackground from "@/components/auth/MusicBackground";
import logoFull from "@/assets/logo-mic-heart.png";
import { parseResetLink } from "@/lib/resetLink";
import { markRemembered } from "@/lib/rememberMe";

const inputCls = "w-full px-4 py-3 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary";

/** Landing page for the "set a new password" email link. */
const ResetPassword = () => {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [expired, setExpired] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let done = false;
    const markReady = () => { done = true; setReady(true); setExpired(false); };
    const markExpired = () => { if (!done) { done = true; setExpired(true); } };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session) markReady();
    });

    // Read the link once, then remove the tokens from the address bar.
    const link = parseResetLink(window.location.search, window.location.hash);
    if (link.kind !== "none") window.history.replaceState(null, "", "/reset-password");

    // If the link fails, only call it expired when no session exists after all
    // (the sign-in library may already have used the same link by itself).
    const settle = async (error: unknown) => {
      if (!error) return markReady();
      const { data } = await supabase.auth.getSession();
      if (data.session) markReady(); else markExpired();
    };

    const run = async () => {
      if (link.kind === "error") return markExpired();
      if (link.kind === "tokens") {
        const { error } = await supabase.auth.setSession({ access_token: link.accessToken, refresh_token: link.refreshToken });
        return settle(error);
      }
      if (link.kind === "code") {
        const { error } = await supabase.auth.exchangeCodeForSession(link.code);
        return settle(error);
      }
      if (link.kind === "token_hash") {
        const { error } = await supabase.auth.verifyOtp({ token_hash: link.tokenHash, type: "recovery" });
        return settle(error);
      }
      const { data } = await supabase.auth.getSession();
      if (data.session) markReady();
    };
    run().catch(() => settle(true));

    // Never wait forever: no session after 8 seconds → the link has expired or was used.
    const t = setTimeout(markExpired, 8000);
    return () => { subscription.unsubscribe(); clearTimeout(t); };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    if (password !== confirm) return toast.error("Passwords don't match");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    markRemembered();
    toast.success("Your password has been updated");
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
      <MusicBackground />
      <div className="w-full max-w-md glass-card p-8">
        <img src={logoFull} alt="Loveworld Music+ logo" className="mx-auto mb-4 h-20 w-20 rounded-[22px] object-contain shadow-[0_6px_28px_hsl(43_70%_53%/0.4)]" />
        <h1 className="text-2xl font-serif gradient-gold-text font-bold text-center mb-2">Set a new password</h1>
        {!ready && expired ? (
          <>
            <p className="text-sm text-muted-foreground text-center mb-6">This reset link has expired or was already used. Request a new one from the sign-in page.</p>
            <button onClick={() => navigate("/auth")} className="w-full py-3 rounded-lg gradient-gold text-primary-foreground font-semibold hover:opacity-90">Back to Sign In</button>
          </>
        ) : !ready ? (
          <p className="text-sm text-muted-foreground text-center">Checking your link…</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="relative">
              <input type={show ? "text" : "password"} placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" className={`${inputCls} pr-12`} />
              <button type="button" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground">
                {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <input type={show ? "text" : "password"} placeholder="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} autoComplete="new-password" className={inputCls} />
            <button type="submit" disabled={loading} className="w-full py-3 rounded-lg gradient-gold text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
              {loading ? "Saving..." : "Save new password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
