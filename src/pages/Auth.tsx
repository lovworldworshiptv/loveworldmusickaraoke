import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Eye, EyeOff, MessageCircle } from "lucide-react";
import MusicBackground from "@/components/auth/MusicBackground";
import { supabase } from "@/integrations/supabase/client";
import logoFull from "@/assets/logo-mic-heart.png";

// ---------------------------------------------------------------------------
// KingsChat OAuth2 Authorization Code flow.
// 1. Open popup to https://accounts.kingschat.online/log-in?clientId=...&origin=<nonce>&forceLogin=true
// 2. KingsChat POSTs {code, origin} server-to-server to our edge function
//    (kingschat-callback), which exchanges the code for tokens, provisions/
//    signs in the user, and stashes the Supabase session keyed by nonce.
// 3. Browser polls kingschat-poll?nonce=<nonce> until status=ready, then
//    calls supabase.auth.setSession() to establish the session locally.
// ---------------------------------------------------------------------------
const KINGSCHAT_CLIENT_ID = "35769f15-f514-4838-83cd-a393dea6fa03";
const KC_LOGIN_URL = "https://accounts.kingschat.online/log-in";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

const Auth = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [kcLoading, setKcLoading] = useState(false);
  const popupRef = useRef<Window | null>(null);
  const pollTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
      try { popupRef.current?.close(); } catch { /* ignore */ }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (isSignUp) {
      const { error } = await signUp(email, password, username);
      if (error) toast.error(error.message);
      else toast.success("Check your email to confirm your account!");
    } else {
      const { error } = await signIn(email, password);
      if (error) toast.error(error.message);
      else navigate("/");
    }
    setLoading(false);
  };

  const stopPolling = () => {
    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  const handleKingsChatLogin = async () => {
    if (kcLoading) return;
    setKcLoading(true);

    const nonce = crypto.randomUUID();
    const loginUrl = `${KC_LOGIN_URL}?clientId=${encodeURIComponent(
      KINGSCHAT_CLIENT_ID
    )}&origin=${encodeURIComponent(nonce)}&forceLogin=true`;

    // Open popup synchronously (must be in click handler to avoid popup blockers)
    const w = 480;
    const h = 680;
    const left = window.screenX + Math.max(0, (window.outerWidth - w) / 2);
    const top = window.screenY + Math.max(0, (window.outerHeight - h) / 2);
    popupRef.current = window.open(
      loginUrl,
      "kingschat_login",
      `width=${w},height=${h},left=${left},top=${top}`
    );

    if (!popupRef.current) {
      setKcLoading(false);
      toast.error("Popup blocked. Please allow popups and try again.");
      return;
    }

    const startedAt = Date.now();
    const pollUrl = `${SUPABASE_URL}/functions/v1/kingschat-poll?nonce=${encodeURIComponent(nonce)}`;

    pollTimerRef.current = window.setInterval(async () => {
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        stopPolling();
        setKcLoading(false);
        toast.error("KingsChat sign-in timed out. Please try again.");
        try { popupRef.current?.close(); } catch { /* ignore */ }
        return;
      }

      try {
        const res = await fetch(pollUrl, {
          headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string },
        });
        if (!res.ok) return;
        const data = await res.json();

        if (data.status === "ready" && data.session) {
          stopPolling();
          try { popupRef.current?.close(); } catch { /* ignore */ }
          await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          });
          toast.success(`Welcome, ${data.kingschat_profile?.username || "User"}!`);
          setKcLoading(false);
          navigate("/");
        } else if (data.status === "error") {
          stopPolling();
          setKcLoading(false);
          try { popupRef.current?.close(); } catch { /* ignore */ }
          toast.error(data.error || "KingsChat sign-in failed.");
        } else if (data.status === "expired") {
          stopPolling();
          setKcLoading(false);
          try { popupRef.current?.close(); } catch { /* ignore */ }
          toast.error("KingsChat sign-in expired. Please try again.");
        }
      } catch (err) {
        console.warn("KC poll error", err);
      }
    }, POLL_INTERVAL_MS);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
      <MusicBackground />
      <button onClick={() => navigate(-1)} className="absolute top-4 left-4 w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-5 h-5" />
      </button>
      <div className="w-full max-w-md glass-card p-8">
        <img
          src={logoFull}
          alt="Loveworld Music Karaoke+ logo"
          className="mx-auto mb-4 h-20 w-auto object-contain drop-shadow-[0_4px_24px_hsl(43_70%_53%/0.35)]"
        />
        <h1 className="text-2xl font-serif gradient-gold-text font-bold text-center mb-6">Loveworld Music Karaoke+</h1>

        <button
          onClick={handleKingsChatLogin}
          disabled={kcLoading}
          className="w-full py-3 rounded-lg bg-[#0075FF] text-white font-semibold hover:bg-[#0060DD] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mb-6"
        >
          <MessageCircle className="w-5 h-5" />
          {kcLoading ? "Waiting for KingsChat…" : "Sign in with KingsChat"}
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground uppercase">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <input
              type="text" placeholder="Username" value={username}
              onChange={(e) => setUsername(e.target.value)} required
              className="w-full px-4 py-3 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          )}
          <input
            type="email" placeholder="Email" value={email}
            onChange={(e) => setEmail(e.target.value)} required
            className="w-full px-4 py-3 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"} placeholder="Password" value={password}
              onChange={(e) => setPassword(e.target.value)} required minLength={6}
              className="w-full px-4 py-3 pr-12 rounded-lg bg-muted border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-lg gradient-gold text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
            {loading ? "Loading..." : isSignUp ? "Sign Up" : "Sign In"}
          </button>
        </form>

        <p className="text-sm text-muted-foreground text-center mt-6">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button onClick={() => setIsSignUp(!isSignUp)} className="text-gold hover:underline">
            {isSignUp ? "Sign In" : "Sign Up"}
          </button>
        </p>
      </div>
    </div>
  );
};

export default Auth;
