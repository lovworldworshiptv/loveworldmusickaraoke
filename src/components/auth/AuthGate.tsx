import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Lock, Music, Sparkles, LogIn, UserPlus } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import MusicBackground from "@/components/auth/MusicBackground";

interface AuthGateProps {
  children: React.ReactNode;
}

const AuthGate = ({ children }: AuthGateProps) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!user) {
    return (
      <AppLayout>
        <div className="relative flex items-center justify-center min-h-[70vh] px-4">
          <MusicBackground />
          <div className="relative z-10 w-full max-w-sm text-center">
            {/* Animated icon cluster */}
            <div className="relative w-28 h-28 mx-auto mb-8">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-gold/20 via-gold-light/10 to-transparent animate-pulse" />
              <div className="absolute inset-2 rounded-full bg-gradient-to-br from-gold/10 to-transparent backdrop-blur-sm" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Lock className="w-10 h-10 text-gold drop-shadow-lg" />
              </div>
              <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-gradient-to-br from-gold via-gold-light to-gold flex items-center justify-center shadow-[0_4px_20px_hsl(43_70%_53%/0.4)] animate-bounce" style={{ animationDuration: "2s" }}>
                <Music className="w-4 h-4 text-white" />
              </div>
              <div className="absolute -bottom-1 -left-1 w-7 h-7 rounded-full bg-gradient-to-br from-gold via-gold-light to-gold flex items-center justify-center shadow-[0_4px_20px_hsl(43_70%_53%/0.4)] animate-bounce" style={{ animationDuration: "2.5s", animationDelay: "0.3s" }}>
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
            </div>

            {/* Message */}
            <h2 className="text-2xl font-serif font-bold gradient-gold-text mb-2">
              Unlock the Full Experience
            </h2>
            <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
              Sign in to explore your library, play games, discover new music, read articles and so much more!
            </p>

            {/* Action buttons */}
            <div className="flex flex-col gap-3">
              <button
                onClick={() => navigate("/auth")}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-gold via-gold-light to-gold text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-[0_4px_24px_hsl(43_70%_53%/0.4)] hover:shadow-[0_6px_32px_hsl(43_70%_53%/0.55)] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              >
                <LogIn className="w-4 h-4" />
                Sign In
              </button>
              <button
                onClick={() => navigate("/auth")}
                className="w-full py-3.5 rounded-xl border border-border text-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:bg-muted/60 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              >
                <UserPlus className="w-4 h-4" />
                Create Account
              </button>
            </div>

            {/* Subtle features list */}
            <div className="mt-8 grid grid-cols-3 gap-2">
              {[
                { icon: "🎵", label: "Full Library" },
                { icon: "🎮", label: "Lyric Games" },
                { icon: "📖", label: "Articles" },
              ].map((feat) => (
                <div key={feat.label} className="glass-card p-3 rounded-xl">
                  <span className="text-lg mb-1 block">{feat.icon}</span>
                  <span className="text-[10px] text-muted-foreground font-medium">{feat.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return <>{children}</>;
};

export default AuthGate;
