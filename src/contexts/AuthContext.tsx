import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { claimStoredInvite, captureInviteFromUrl } from "@/lib/platformReferral";
import { markRemembered, shouldForgetSession } from "@/lib/rememberMe";
import { logActivityDay, stopActivityTracking } from "@/lib/activityCountry";
import { confirmRedirectUrl } from "@/lib/emailLink";

captureInviteFromUrl();
import type { User, Session } from "@supabase/supabase-js";

interface ProfileData {
  username?: string | null;
  email?: string | null;
  kingschat_handle?: string | null;
  church?: string | null;
  zone?: string | null;
  region?: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  username: string;
  avatarUrl: string | null;
  kingschatHandle: string | null;
  profileCompleted: boolean;
  profileData: ProfileData;
  loading: boolean;
  signUp: (email: string, password: string, username: string, inviteCode?: string) => Promise<{ error: any; data?: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  sendPasswordReset: (email: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  markProfileCompleted: () => void;
  refetchProfile: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [username, setUsername] = useState("Guest");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [kingschatHandle, setKingschatHandle] = useState<string | null>(null);
  const [profileCompleted, setProfileCompleted] = useState(true);
  const [profileData, setProfileData] = useState<ProfileData>({});
  const [loading, setLoading] = useState(true);

  const fetchProfile = (userId: string) => {
    supabase.from("profiles").select("username, avatar_url, kingschat_handle, email, church, zone, region, profile_completed").eq("user_id", userId).single()
      .then(({ data }) => {
        if (data) {
          setUsername(data.username);
          setAvatarUrl(data.avatar_url);
          setKingschatHandle((data as any).kingschat_handle ?? null);
          setProfileCompleted((data as any).profile_completed ?? false);
          setProfileData({
            username: data.username,
            email: (data as any).email,
            kingschat_handle: (data as any).kingschat_handle,
            church: (data as any).church,
            zone: (data as any).zone,
            region: (data as any).region,
          });
        }
      });
  };

  const markProfileCompleted = () => {
    setProfileCompleted(true);
  };

  const refetchProfile = () => {
    if (user) fetchProfile(user.id);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        const metaInvite = (session.user.user_metadata as any)?.invite_code ?? null;
        setTimeout(() => { fetchProfile(session.user.id); claimStoredInvite(metaInvite); logActivityDay(session.user.id).catch(() => undefined); }, 0);
      } else {
        stopActivityTracking();
        setUsername("Guest");
        setAvatarUrl(null);
        setKingschatHandle(null);
      }
    });

    const start = async () => {
      if (window.location.pathname.startsWith("/reset-password")) {
        // Never drop the recovery session from a reset link; this tab counts as active.
        markRemembered();
      } else if (shouldForgetSession()) {
        // "Remember me" was off last time and the browser/app has since been closed.
        await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
      }
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    };
    start();

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, uname: string, inviteCode?: string) => {
    const code = (inviteCode || "").trim();
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: {
        data: { username: uname, ...(code ? { invite_code: code.slice(0, 80) } : {}) },
        // The confirm page finishes sign-up (and the invite claim) on the branded site.
        emailRedirectTo: confirmRedirectUrl(),
      },
    });
    return { error, data };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const sendPasswordReset = async (email: string) => {
    // Always land on the branded production site, never a Lovable preview/hosting address.
    const host = window.location.hostname;
    const isLocal = host === "localhost" || host === "127.0.0.1";
    const origin = isLocal ? window.location.origin : "https://loveworldmusickaraoke.com";
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${origin}/reset-password`,
    });
    return { error };
  };

  const signOut = async () => {
    // Offline songs are tied to this account and device: free the device slot and clear them.
    await import("@/lib/secureDownloads/engine").then((m) => m.signOutCleanup()).catch(() => undefined);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, username, avatarUrl, kingschatHandle, profileCompleted, profileData, loading, signUp, signIn, sendPasswordReset, signOut, markProfileCompleted, refetchProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
