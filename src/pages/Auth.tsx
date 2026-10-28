import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Eye, EyeOff, Gift, MessageCircle } from "lucide-react";
import MusicBackground from "@/components/auth/MusicBackground";
import logoFull from "@/assets/logo-mic-heart.png";
import { signInWithKingsChat } from "@/lib/kingschat";
import { getStoredInvite, inviteCodeFromSearch, lookupInviter, storeInvite } from "@/lib/platformReferral";
import { applyRememberMe, getRememberedEmail, getRememberMe, markRemembered } from "@/lib/rememberMe";

const getSafeNextPath = (search: string) => {
  const next = new URLSearchParams(search).get("next");
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
};

type Mode = "signin" | "signup" | "forgot";

const inputCls = "w-full px-4 py-3 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary";

const Auth = () => {
  const location = useLocation();
  const urlInvite = inviteCodeFromSearch(location.search);
  const [mode, setMode] = useState<Mode>(urlInvite ? "signup" : "signin");
  const [email, setEmail] = useState(getRememberedEmail());
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [inviteEdited, setInviteEdited] = useState(false);
  const [inviter, setInviter] = useState<string | null>(null);
  const [remember, setRemember] = useState(getRememberMe());
  const [showPassword, setShowPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const { signIn, signUp, sendPasswordReset, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [kcLoading, setKcLoading] = useState(false);
  const nextPath = getSafeNextPath(location.search);

  // Show who invited the visitor (from the link, or a code saved earlier).
  useEffect(() => {
    const code = urlInvite || getStoredInvite();
    if (!code) return;
    lookupInviter(code).then((name) => {
      setInviter(name);
      setInviteCode((c) => c || name || code);
    });
  }, [urlInvite]);

  // Already signed in (e.g. opened an invite link while logged in): go on.
  useEffect(() => { if (user && mode !== "forgot") navigate(nextPath, { replace: true }); }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Keep the precise code from the link unless the visitor typed a different one. */
  const commitInviteCode = () => {
    const stored = getStoredInvite();
    if (!inviteEdited) return stored || undefined;
    const typed = inviteCode.trim();
    storeInvite(typed || null);
    return typed || undefined;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (mode === "forgot") {
      const { error } = await sendPasswordReset(email);
      if (error) toast.error(error.message);
      else setResetSent(true);
    } else if (mode === "signup") {
      const code = commitInviteCode();
      const { error } = await signUp(email, password, username, code);
      if (error) toast.error(error.message);
      else toast.success("Check your email to confirm your account!");
    } else {
      const { error } = await signIn(email, password);
      if (error) toast.error(error.message);
      else {
        applyRememberMe(remember, email);
        navigate(nextPath, { replace: true });
      }
    }
    setLoading(false);
  };

  const handleKingsChatLogin = async () => {
    if (kcLoading) return;
    setKcLoading(true);
    try {
      if (mode === "signup") commitInviteCode();
      const { redirectPath, username: kcName } = await signInWithKingsChat(nextPath);
      markRemembered();
      toast.success(`Welcome, ${kcName || "User"}!`);
      navigate(redirectPath || nextPath, { replace: true });
    } catch (err: any) {
      console.error("KingsChat login error:", err);
      const msg = err?.message || String(err) || "KingsChat sign-in failed";
      if (!/cancel|closed/i.test(msg)) toast.error(msg);
    } finally {
      setKcLoading(false);
    }
  };

  const switchMode = (m: Mode) => { setMode(m); setResetSent(false); };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
      <MusicBackground />
      <button onClick={() => navigate(-1)} aria-label="Go back" className="absolute top-4 left-4 w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-5 h-5" />
      </button>
      <div className="w-full max-w-md glass-card p-8">
        <img
          src={logoFull}
          alt="Loveworld Music+ logo"
          className="mx-auto mb-4 h-20 w-20 rounded-[22px] object-contain shadow-[0_6px_28px_hsl(43_70%_53%/0.4)]"
        />
        <h1 className="text-2xl font-serif gradient-gold-text font-bold text-center mb-6">Loveworld Music+</h1>

        {inviter && mode !== "forgot" && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-foreground">
            <Gift className="h-5 w-5 shrink-0 text-gold" />
            <span><span className="font-semibold text-gold">{inviter}</span> invited you to Loveworld Music+</span>
          </div>
        )}

        {mode === "forgot" ? (
          <>
            <h2 className="text-lg font-semibold text-foreground text-center mb-2">Forgot your password?</h2>
            {resetSent ? (
              <p className="text-sm text-muted-foreground text-center mb-6">
                If an account exists for <span className="text-foreground font-medium">{email}</span>, a link to set a new password is on its way. Check your inbox and spam folder.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground text-center mb-6">Enter your email and we'll send you a link to set a new password.</p>
            )}
            {!resetSent && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className={inputCls} />
                <button type="submit" disabled={loading} className="w-full py-3 rounded-lg gradient-gold text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
                  {loading ? "Sending..." : "Send reset link"}
                </button>
              </form>
            )}
            <p className="text-sm text-muted-foreground text-center mt-6">
              Signed in with KingsChat? Just use the KingsChat button — no password needed.
            </p>
            <p className="text-sm text-center mt-3">
              <button onClick={() => switchMode("signin")} className="text-gold hover:underline">Back to Sign In</button>
            </p>
          </>
        ) : (
          <>
            <button
              onClick={handleKingsChatLogin}
              disabled={kcLoading}
              className="w-full py-3 rounded-lg bg-[#0075FF] text-white font-semibold hover:bg-[#0060DD] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mb-6"
            >
              <MessageCircle className="w-5 h-5" />
              {kcLoading ? "Waiting for KingsChat…" : mode === "signup" ? "Sign up with KingsChat" : "Sign in with KingsChat"}
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground uppercase">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete="username" className={inputCls} />
              )}
              <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className={inputCls} />
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"} placeholder="Password" value={password}
                  onChange={(e) => setPassword(e.target.value)} required minLength={6}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  className={`${inputCls} pr-12`}
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {mode === "signup" && (
                <input type="text" placeholder="Invite code (optional)" value={inviteCode} onChange={(e) => { setInviteCode(e.target.value); setInviteEdited(true); }} aria-label="Invite code" className={inputCls} />
              )}

              {mode === "signin" && (
                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2 text-muted-foreground cursor-pointer select-none">
                    <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--gold))]" />
                    Remember me
                  </label>
                  <button type="button" onClick={() => switchMode("forgot")} className="text-gold hover:underline">Forgot password?</button>
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-lg gradient-gold text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
                {loading ? "Loading..." : mode === "signup" ? "Sign Up" : "Sign In"}
              </button>
            </form>

            <p className="text-sm text-muted-foreground text-center mt-6">
              {mode === "signup" ? "Already have an account?" : "Don't have an account?"}{" "}
              <button onClick={() => switchMode(mode === "signup" ? "signin" : "signup")} className="text-gold hover:underline">
                {mode === "signup" ? "Sign In" : "Sign Up"}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default Auth;
