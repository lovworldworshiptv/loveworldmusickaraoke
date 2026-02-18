import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { User, Settings, ChevronRight, ChevronLeft, LogOut, Crown, Shield } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTheme, ThemeName } from "@/contexts/ThemeContext";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

const TopNavbar = () => {
  const { user, username, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === "/";
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const { theme, setTheme, themes } = useTheme();
  const [role, setRole] = useState<string>("free");

  useEffect(() => {
    if (user) {
      supabase.from("user_roles").select("role").eq("user_id", user.id).single()
        .then(({ data }) => { if (data) setRole(data.role); });
    }
  }, [user]);

  const roleLabel = role === "admin" ? "Admin" : role === "premium" ? "Premium" : "Free";
  const RoleIcon = role === "admin" ? Shield : role === "premium" ? Crown : User;

  return (
    <header className="sticky top-0 z-40 glass border-b border-border px-4 py-3 flex items-center justify-between lg:ml-64">
      <div className="flex items-center gap-2">
        {!isHome && (
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors active:scale-95"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <h1 className="text-lg font-serif gradient-gold-text font-bold lg:hidden">Loveworld Music</h1>
      </div>
      <div className="hidden lg:block" />

      <div className="flex items-center gap-2">
        {/* Settings */}
        <Popover open={showSettings} onOpenChange={setShowSettings}>
          <PopoverTrigger asChild>
            <button className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <Settings className="w-5 h-5" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-4 bg-card border-border">
            <h3 className="text-sm font-semibold text-foreground mb-3">Theme</h3>
            <div className="grid grid-cols-1 gap-2">
              {themes.map((t) => (
                <button
                  key={t.name}
                  onClick={() => setTheme(t.name)}
                  className={`flex items-center gap-3 p-2.5 rounded-lg text-sm transition-all ${
                    theme === t.name
                      ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <span className="w-5 h-5 rounded-full flex-shrink-0 ring-1 ring-border" style={{ background: t.preview }} />
                  {t.label}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Profile Avatar */}
        <Popover open={showProfile} onOpenChange={setShowProfile}>
          <PopoverTrigger asChild>
            {user ? (
              <button className="w-9 h-9 rounded-full gradient-gold flex items-center justify-center text-primary-foreground text-sm font-bold font-serif hover:opacity-90 transition-opacity">
                {username.charAt(0).toUpperCase()}
              </button>
            ) : (
              <button className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                <User className="w-5 h-5" />
              </button>
            )}
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-0 bg-card border-border overflow-hidden">
            {user ? (
              <>
                {/* User Info */}
                <div className="p-4 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full gradient-gold flex items-center justify-center text-primary-foreground text-lg font-bold font-serif">
                      {username.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">Welcome Esteemed</p>
                      <p className="text-sm gradient-gold-text font-bold truncate">{username}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </div>
                  <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-xs font-semibold text-primary">
                    <RoleIcon className="w-3 h-3" /> {roleLabel}
                  </div>
                </div>

                {/* Menu Items */}
                <div className="p-2">
                  <button
                    onClick={() => { setShowProfile(false); navigate("/profile"); }}
                    className="w-full flex items-center justify-between p-2.5 rounded-lg text-sm text-foreground hover:bg-muted transition-colors"
                  >
                    <span className="flex items-center gap-2"><User className="w-4 h-4" /> My Profile</span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => { setShowProfile(false); navigate("/library"); }}
                    className="w-full flex items-center justify-between p-2.5 rounded-lg text-sm text-foreground hover:bg-muted transition-colors"
                  >
                    <span className="flex items-center gap-2"><Crown className="w-4 h-4" /> My Favorites</span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                  {role === "admin" && (
                    <button
                      onClick={() => { setShowProfile(false); navigate("/admin/songs"); }}
                      className="w-full flex items-center justify-between p-2.5 rounded-lg text-sm text-foreground hover:bg-muted transition-colors"
                    >
                      <span className="flex items-center gap-2"><Shield className="w-4 h-4" /> Admin Panel</span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </button>
                  )}
                </div>

                {/* Sign Out */}
                <div className="p-2 border-t border-border">
                  <button
                    onClick={async () => { setShowProfile(false); await signOut(); navigate("/"); }}
                    className="w-full flex items-center gap-2 p-2.5 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </div>
              </>
            ) : (
              <div className="p-4 text-center">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                  <User className="w-7 h-7 text-muted-foreground" />
                </div>
                <p className="text-sm text-foreground font-medium mb-1">Not signed in</p>
                <p className="text-xs text-muted-foreground mb-3">Sign in to access your profile</p>
                <button
                  onClick={() => { setShowProfile(false); navigate("/auth"); }}
                  className="gradient-gold text-primary-foreground px-6 py-2 rounded-full text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  Sign In
                </button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
};

export default TopNavbar;
