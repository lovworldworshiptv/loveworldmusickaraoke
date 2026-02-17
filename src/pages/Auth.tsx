import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";

const Auth = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <button onClick={() => navigate(-1)} className="absolute top-4 left-4 w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-5 h-5" />
      </button>
      <div className="w-full max-w-md glass-card p-8">
        <h1 className="text-2xl font-serif gradient-gold-text font-bold text-center mb-2">Loveworld Music</h1>
        <p className="text-sm text-muted-foreground text-center mb-8">Karaoke & Study+</p>

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
