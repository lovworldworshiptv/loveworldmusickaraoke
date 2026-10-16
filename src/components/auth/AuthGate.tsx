import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { Lock, Music, Sparkles, LogIn, UserPlus } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import MusicBackground from "@/components/auth/MusicBackground";
import OfflineScreen from "@/components/offline/OfflineScreen";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

interface AuthGateProps {
  children: React.ReactNode;
}

const AuthGate = ({ children }: AuthGateProps) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isOnline = useOnlineStatus();

  // Offline pages still work from saved data (Library, Studio, Stage); others
  // are moved to Downloads by OfflineRedirect. Only show the offline screen
  // when there is no signed-in session to fall back on.
  const signInPath = `/auth?next=${encodeURIComponent(`${location.pathname}${location.search}`)}`;

  if (!isOnline && !user && !loading) {
    return (
      <AppLayout>
        <OfflineScreen />
      </AppLayout>
    );
  }

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
            <div className="relative w-28 h-28 mx-auto mb-8">
              <div className="absolute -inset-3 rounded-[32px] bg-gold/15 blur-xl animate-pulse motion-reduce:animate-none" />
              <img src={logo} alt="Loveworld Music Karaoke+" className="relative w-28 h-28 rounded-[28px] shadow-[0_8px_32px_hsl(43_70%_53%/0.45)]" />
              <div className="absolute -bottom-2 -right-2 w-9 h-9 rounded-full bg-background border border-gold/40 flex items-center justify-center shadow-lg">
                <Lock className="w-4 h-4 text-gold" />
              </div>
            </div>

            <h2 className="text-2xl font-serif font-bold gradient-gold-text mb-2">
              Unlock the Full Experience
            </h2>
            <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
              Sign in to explore your library, play games, discover new music, read articles and so much more!
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => navigate(signInPath)}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-gold via-gold-light to-gold text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-[0_4px_24px_hsl(43_70%_53%/0.4)] hover:shadow-[0_6px_32px_hsl(43_70%_53%/0.55)] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              >
                <LogIn className="w-4 h-4" />
                Sign In
              </button>
              <button
                onClick={() => navigate(signInPath)}
                className="w-full py-3.5 rounded-xl border border-border text-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:bg-muted/60 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              >
                <UserPlus className="w-4 h-4" />
                Create Account
              </button>
            </div>

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
