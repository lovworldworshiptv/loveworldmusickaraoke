import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Eye, EyeOff, MessageCircle } from "lucide-react";
import MusicBackground from "@/components/auth/MusicBackground";
import { supabase } from "@/integrations/supabase/client";
import logoFull from "@/assets/logo-mic-heart.png";

// ---------------------------------------------------------------------------
// KingsChat OAuth (authorization-code flow via popup + poll).
// The legacy SDK-based flow was removed in favor of the redirect-based flow
// that pairs with supabase/functions/kingschat-callback + kingschat-poll and
// src/pages/KingsChatCallback.tsx.
// ---------------------------------------------------------------------------
const KINGSCHAT_CLIENT_ID = "a8c5d32f-1ff1-4217-97b3-382f928f7b1e";
const KINGSCHAT_LOGIN_URL = "https://accounts.kingschat.online/log-in";
const KINGSCHAT_SCOPES = ["send_chat_message"];

const buildKcAuthUrl = (nonce: string) => {
  const redirectUri = `${window.location.origin}/auth/kingschat-callback`;
  const params = new URLSearchParams({
    client_id: KINGSCHAT_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: KINGSCHAT_SCOPES.join(" "),
    state: nonce,
  });
  return `${KINGSCHAT_LOGIN_URL}?${params.toString()}`;
};

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
  const cancelRef = useRef(false);

  useEffect(() => () => { cancelRef.current = true; }, []);

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

  const handleKingsChatLogin = async () => {
    if (kcLoading) return;
    setKcLoading(true);

    const nonce = crypto.randomUUID();
    const authUrl = buildKcAuthUrl(nonce);
    const popup = window.open(authUrl, "kingschat_auth", "width=520,height=680");
    if (!popup) {
      toast.error("Please allow popups to sign in with KingsChat.");
      setKcLoading(false);
      return;
    }

    const started = Date.now();
    const timeoutMs = 3 * 60 * 1000;
    let done = false;

    const poll = async () => {
      if (done || cancelRef.current) return;
      if (Date.now() - started > timeoutMs) {
        done = true;
        toast.error("KingsChat sign-in timed out. Please try again.");
        setKcLoading(false);
        try { popup.close(); } catch {}
        return;
      }
      try {
        const { data, error } = await supabase.functions.invoke("kingschat-poll", {
          method: "GET" as any,
          body: undefined,
          headers: {},
          // @ts-ignore - allow query params via URL
        });
        // supabase.functions.invoke doesn't support query params cleanly,
        // fall back to fetch with the nonce query.
        if (error || !data) throw error || new Error("poll failed");
      } catch {
        // Use direct fetch to include ?nonce=
      }
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kingschat-poll?nonce=${encodeURIComponent(nonce)}`;
        const res = await fetch(url, {
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        });
        const json = await res.json();
        if (json?.status === "ready" && json?.session) {
          done = true;
          await supabase.auth.setSession({
            access_token: json.session.access_token,
            refresh_token: json.session.refresh_token,
          });
          toast.success(`Welcome, ${json.kingschat_profile?.username || "User"}!`);
          try { popup.close(); } catch {}
          if (!cancelRef.current) setKcLoading(false);
          navigate("/");
          return;
        }
        if (json?.status === "error") {
          done = true;
          toast.error(json.error || "KingsChat sign-in failed.");
          try { popup.close(); } catch {}
          if (!cancelRef.current) setKcLoading(false);
          return;
        }
        if (json?.status === "expired") {
          done = true;
          toast.error("KingsChat sign-in expired. Please try again.");
          try { popup.close(); } catch {}
          if (!cancelRef.current) setKcLoading(false);
          return;
        }
      } catch (e) {
        // network hiccup — keep polling
      }

      if (popup.closed && !done) {
        // Keep polling briefly in case callback finished right before close
        setTimeout(() => {
          if (!done) {
            done = true;
            if (!cancelRef.current) setKcLoading(false);
          }
        }, 2500);
      }

      setTimeout(poll, 1500);
    };

    poll();
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
