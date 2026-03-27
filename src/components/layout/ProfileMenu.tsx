import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { User, Settings, ChevronRight, LogOut, Crown, Shield, Palette, AtSign, Music2, Disc3, List, Newspaper, Grid3X3, Image, Gamepad2, MessageSquare, Sparkles, Users, BarChart3, Bell, Mic2, Clock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useTheme, ThemeName } from "@/contexts/ThemeContext";
import { supabase } from "@/integrations/supabase/client";
import { useIsPremium } from "@/hooks/useIsPremium";

const adminItems = [
  { icon: Music2, label: "Manage Songs", path: "/admin/songs" },
  { icon: Disc3, label: "Manage Albums", path: "/admin/albums" },
  { icon: List, label: "Manage Playlists", path: "/admin/playlists" },
  { icon: Newspaper, label: "Manage Articles", path: "/admin/articles" },
  { icon: Grid3X3, label: "Manage Categories", path: "/admin/categories" },
  { icon: Image, label: "Manage Banners", path: "/admin/banners" },
  { icon: Gamepad2, label: "Manage Games", path: "/admin/games" },
  { icon: MessageSquare, label: "Manage Feedback", path: "/admin/feedback" },
  { icon: Sparkles, label: "Onboarding Screens", path: "/admin/onboarding" },
  { icon: Sparkles, label: "Premium Ads", path: "/admin/premium-ads" },
  { icon: Users, label: "Manage Users", path: "/admin/users" },
  { icon: Crown, label: "Pending Subscriptions", path: "/admin/subscriptions" },
  { icon: Bell, label: "Homepage Popup", path: "/admin/popup" },
  { icon: Bell, label: "Notifications", path: "/admin/notifications" },
  { icon: BarChart3, label: "Analytics", path: "/admin/analytics" },
  { icon: Mic2, label: "Feature Toggles", path: "/admin/karaoke-stories" },
];
const ProfileMenu = () => {
  const { user, username, avatarUrl, kingschatHandle, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"main" | "settings">("main");
  const { theme, setTheme, themes } = useTheme();
  const [role, setRole] = useState<string>("user");
  const { isPremium, isTrial, loading: premiumLoading } = useIsPremium();

  useEffect(() => {
    if (user) {
      supabase.from("user_roles").select("role").eq("user_id", user.id).single()
        .then(({ data }) => { if (data) setRole(data.role); });
    }
  }, [user]);

  const subLabel = isTrial ? "Trial" : isPremium ? "Premium" : "Free";
  const SubIcon = isTrial ? Clock : isPremium ? Crown : User;

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) setView("main");
  };

  const [adminSheetOpen, setAdminSheetOpen] = useState(false);

  const roleLabel = role === "admin" ? "Admin" : role === "editor" ? "Editor" : "User";
  const RoleIcon = role === "admin" ? Shield : role === "editor" ? Crown : User;

  return (
    <>
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
                    {kingschatHandle ? (
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-0.5"><AtSign className="w-3 h-3" />{kingschatHandle}</p>
                    ) : user.email && !user.email.includes("@kingschat.local") ? (
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-xs font-semibold text-primary">
                    <RoleIcon className="w-3 h-3" /> {roleLabel}
                  </span>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${isPremium || isTrial ? "bg-gold/20 text-gold" : "bg-muted text-muted-foreground"}`}>
                    <SubIcon className="w-3 h-3" /> {subLabel}
                  </span>
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
                    onClick={() => { setOpen(false); setAdminSheetOpen(true); }}
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

    <Sheet open={adminSheetOpen} onOpenChange={setAdminSheetOpen}>
      <SheetContent side="left" className="w-[280px] p-0 overflow-y-auto">
        <SheetHeader className="p-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-foreground">
            <Shield className="w-5 h-5 text-primary" /> Admin Panel
          </SheetTitle>
        </SheetHeader>
        <nav className="p-2 space-y-1">
          {adminItems.map((item) => (
            <button
              key={item.path}
              onClick={() => { setAdminSheetOpen(false); navigate(item.path); }}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <item.icon className="w-5 h-5 text-muted-foreground" />
              {item.label}
            </button>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
    </>
  );
};

export default ProfileMenu;
