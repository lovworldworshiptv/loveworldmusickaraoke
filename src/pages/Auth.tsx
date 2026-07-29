import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Eye, EyeOff, MessageCircle } from "lucide-react";
import MusicBackground from "@/components/auth/MusicBackground";
import logoFull from "@/assets/logo-mic-heart.png";
import { signInWithKingsChat } from "@/lib/kingschat";

const getSafeNextPath = (search: string) => {
  const next = new URLSearchParams(search).get("next");
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
};

const Auth = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [kcLoading, setKcLoading] = useState(false);
  const nextPath = getSafeNextPath(location.search);


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
      else navigate(nextPath, { replace: true });
    }
    setLoading(false);
  };

  const handleKingsChatLogin = async () => {
    if (kcLoading) return;
    setKcLoading(true);
    try {
      const result = await kingsChatWebSdk.login({
        clientId: KINGSCHAT_CLIENT_ID,
        scopes: KC_SCOPES as any,
      });

      if (!result?.accessToken) throw new Error("No access token returned from KingsChat");


      const { data, error } = await supabase.functions.invoke("kingschat-auth", {
        body: { accessToken: result.accessToken },
      });

      if (error) throw new Error(error.message || "KingsChat sign-in failed");
      if (!data?.session) throw new Error("No session returned");

      await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });

      toast.success(`Welcome, ${data.kingschat_profile?.username || "User"}!`);
      navigate(nextPath, { replace: true });
    } catch (err: any) {
      console.error("KingsChat login error:", err);
      const msg = err?.message || String(err) || "KingsChat sign-in failed";
      if (!/cancel|closed/i.test(msg)) toast.error(msg);
    } finally {
      setKcLoading(false);
    }
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
