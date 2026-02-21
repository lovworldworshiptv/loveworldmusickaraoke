import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Eye, EyeOff, MessageCircle } from "lucide-react";
import MusicBackground from "@/components/auth/MusicBackground";
import kingsChatWebSdk from "kingschat-web-sdk";
import { supabase } from "@/integrations/supabase/client";

const KINGSCHAT_CLIENT_ID = "5d4c8670-fd28-4be8-8484-55302b8c3bb6";

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
    setKcLoading(true);
    try {
      const authResponse = await (kingsChatWebSdk as any).login({
        clientId: KINGSCHAT_CLIENT_ID,
        scopes: ["user", "send_chat_message"],
      });

      toast.info("Authenticating with KingsChat...");

      // Log the full response to discover available fields
      console.log("KingsChat full auth response:", JSON.stringify(authResponse));

      // Call edge function with the full auth response
      const { data, error } = await supabase.functions.invoke("kingschat-auth", {
        body: { 
          accessToken: authResponse.accessToken,
          fullResponse: authResponse,
        },
      });

      if (error) {
        console.error("KingsChat auth error:", error);
        toast.error("KingsChat authentication failed");
        setKcLoading(false);
        return;
      }

      if (data?.session) {
        // Set the session in Supabase client
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
        toast.success(`Welcome, ${data.kingschat_profile?.username || "User"}!`);
        navigate("/");
      } else {
        toast.error(data?.error || "Authentication failed");
      }
    } catch (err: any) {
      console.error("KingsChat login error:", err);
      if (err.message !== "error") {
        toast.error(err.message || "KingsChat login was cancelled or failed");
      }
    }
    setKcLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
      <MusicBackground />
      <button onClick={() => navigate(-1)} className="absolute top-4 left-4 w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-5 h-5" />
      </button>
      <div className="w-full max-w-md glass-card p-8">
        <h1 className="text-2xl font-serif gradient-gold-text font-bold text-center mb-2">Loveworld Music Karaoke+</h1>

        {/* KingsChat Login Button */}
        <button
          onClick={handleKingsChatLogin}
          disabled={kcLoading}
          className="w-full py-3 rounded-lg bg-[#0075FF] text-white font-semibold hover:bg-[#0060DD] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mb-6"
        >
          <MessageCircle className="w-5 h-5" />
          {kcLoading ? "Connecting..." : "Sign in with KingsChat"}
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
