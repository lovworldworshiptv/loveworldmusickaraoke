import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { claimStoredInvite, captureInviteFromUrl } from "@/lib/platformReferral";
import { shouldForgetSession } from "@/lib/rememberMe";

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
  signUp: (email: string, password: string, username: string, inviteCode?: string) => Promise<{ error: any }>;
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
        setTimeout(() => { fetchProfile(session.user.id); claimStoredInvite(metaInvite); }, 0);
      } else {
        setUsername("Guest");
        setAvatarUrl(null);
        setKingschatHandle(null);
      }
    });

    const start = async () => {
      // "Remember me" was off last time and the browser/app has since been closed.
      if (shouldForgetSession()) await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
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
    const { error } = await supabase.auth.signUp({
      email, password,
      options: {
        data: { username: uname, ...(code ? { invite_code: code.slice(0, 80) } : {}) },
        emailRedirectTo: window.location.origin,
      },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const sendPasswordReset = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
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
