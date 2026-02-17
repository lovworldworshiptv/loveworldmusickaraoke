import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { User, Settings, ChevronRight, LogOut, Crown, Shield, Palette } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTheme, ThemeName } from "@/contexts/ThemeContext";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

const ProfileMenu = () => {
  const { user, username, avatarUrl, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"main" | "settings">("main");
  const { theme, setTheme, themes } = useTheme();
  const [role, setRole] = useState<string>("free");

  useEffect(() => {
    if (user) {
      supabase.from("user_roles").select("role").eq("user_id", user.id).single()
        .then(({ data }) => { if (data) setRole(data.role); });
    }
  }, [user]);

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) setView("main");
  };

  const roleLabel = role === "admin" ? "Admin" : role === "premium" ? "Premium" : "Free";
  const RoleIcon = role === "admin" ? Shield : role === "premium" ? Crown : User;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold font-serif transition-opacity overflow-hidden ${user ? "gradient-gold text-primary-foreground hover:opacity-90" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
          {user ? (avatarUrl ? <img src={avatarUrl} alt={username} className="w-full h-full object-cover" /> : username.charAt(0).toUpperCase()) : <User className="w-5 h-5" />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0 bg-card border-border overflow-hidden">
        {user ? (
          view === "main" ? (
            <>
              {/* User Info */}
              <div className="p-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full gradient-gold flex items-center justify-center text-primary-foreground text-lg font-bold font-serif overflow-hidden">
                    {avatarUrl ? <img src={avatarUrl} alt={username} className="w-full h-full object-cover" /> : username.charAt(0).toUpperCase()}
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
                  onClick={() => setView("settings")}
                  className="w-full flex items-center justify-between p-2.5 rounded-lg text-sm text-foreground hover:bg-muted transition-colors"
                >
                  <span className="flex items-center gap-2"><Settings className="w-4 h-4" /> Settings</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
                <button
                  onClick={() => { setOpen(false); navigate("/profile"); }}
                  className="w-full flex items-center justify-between p-2.5 rounded-lg text-sm text-foreground hover:bg-muted transition-colors"
                >
                  <span className="flex items-center gap-2"><User className="w-4 h-4" /> Profile</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
                {role === "admin" && (
                  <button
                    onClick={() => { setOpen(false); navigate("/admin/songs"); }}
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
                  onClick={async () => { setOpen(false); await signOut(); navigate("/"); }}
                  className="w-full flex items-center gap-2 p-2.5 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            </>
          ) : (
            /* Settings View */
            <>
              <div className="p-3 border-b border-border flex items-center gap-2">
                <button onClick={() => setView("main")} className="text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronRight className="w-4 h-4 rotate-180" />
                </button>
                <h3 className="text-sm font-semibold text-foreground">Settings</h3>
              </div>
              <div className="p-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5" /> Theme
                </p>
                <div className="grid grid-cols-1 gap-1.5">
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
              </div>
            </>
          )
        ) : (
          view === "main" ? (
            <>
              <div className="p-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                    <User className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">Welcome Esteemed</p>
                    <p className="text-sm gradient-gold-text font-bold">Guest</p>
                  </div>
                </div>
              </div>
              <div className="p-2">
                <button
                  onClick={() => setView("settings")}
                  className="w-full flex items-center justify-between p-2.5 rounded-lg text-sm text-foreground hover:bg-muted transition-colors"
                >
                  <span className="flex items-center gap-2"><Settings className="w-4 h-4" /> Settings</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
                <button
                  onClick={() => { setOpen(false); navigate("/auth"); }}
                  className="w-full flex items-center justify-between p-2.5 rounded-lg text-sm text-foreground hover:bg-muted transition-colors"
                >
                  <span className="flex items-center gap-2"><LogOut className="w-4 h-4" /> Sign In</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="p-3 border-b border-border flex items-center gap-2">
                <button onClick={() => setView("main")} className="text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronRight className="w-4 h-4 rotate-180" />
                </button>
                <h3 className="text-sm font-semibold text-foreground">Settings</h3>
              </div>
              <div className="p-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5" /> Theme
                </p>
                <div className="grid grid-cols-1 gap-1.5">
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
              </div>
            </>
          )
        )}
      </PopoverContent>
    </Popover>
  );
};

export default ProfileMenu;
