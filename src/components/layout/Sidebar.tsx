import { Home, Library, Clock, ListMusic, MessageSquare, LogOut, Shield, FileText, BookOpen, Music2, Newspaper, Grid3X3, Disc3, List, Image, Gamepad2, Sparkles, Users, BarChart3, Bell, Crown, Compass, Mic2, AlarmClock, Trophy, Clapperboard } from "lucide-react";
import logo from "@/assets/logo.png";
import { cn } from "@/lib/utils";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useIsEditor } from "@/hooks/useIsEditor";

const navItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Compass, label: "Discover", path: "/discover" },
  { icon: BookOpen, label: "Articles", path: "/articles" },
  { icon: Library, label: "My Library", path: "/library" },
  { icon: Gamepad2, label: "Games", path: "/games" },
  { icon: Disc3, label: "Albums", path: "/albums" },
  { icon: Clapperboard, label: "Videos", path: "/videos" },
  { icon: Clock, label: "History", path: "/history" },
  { icon: ListMusic, label: "Playlist", path: "/playlists" },
  { icon: MessageSquare, label: "Feedback", path: "/feedback" },
  { icon: AlarmClock, label: "Reminders", path: "/reminders" },
];

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
  { icon: Trophy, label: "Challenges", path: "/admin/challenges" },
  { icon: Bell, label: "Homepage Popup", path: "/admin/popup" },
  { icon: Bell, label: "Notifications", path: "/admin/notifications" },
  { icon: BarChart3, label: "Analytics", path: "/admin/analytics" },
  { icon: Mic2, label: "Feature Toggles", path: "/admin/karaoke-stories" },
];

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { isEditor } = useIsEditor();

  return (
    <aside className="hidden lg:flex flex-col w-64 h-screen bg-sidebar border-r border-sidebar-border fixed left-0 top-0 z-30">
      <div className="p-6">
        <img src={logo} alt="Loveworld Music Karaoke+" className="h-10 w-auto" />
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <button
            key={item.label}
            onClick={() => navigate(item.path)}
            className={cn(
              "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
              location.pathname === item.path
                ? "bg-sidebar-accent text-gold"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </button>
        ))}

        {(isAdmin || isEditor) && (
          <>
            <div className="pt-4 pb-1 px-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                {isAdmin ? "Admin" : "Editor"}
              </p>
            </div>
            {(isAdmin ? adminItems : [{ icon: Music2, label: "Manage Songs", path: "/admin/songs" }]).map((item) => (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                className={cn(
                  "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                  location.pathname === item.path
                    ? "bg-sidebar-accent text-gold"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </button>
            ))}
          </>
        )}
      </nav>

      <div className="px-3 pb-6 space-y-1">
        {user ? (
          <button onClick={() => signOut()}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-all duration-200">
            <LogOut className="w-5 h-5" /> Sign Out
          </button>
        ) : (
          <button onClick={() => navigate("/auth")}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gold hover:bg-sidebar-accent transition-all duration-200">
            <LogOut className="w-5 h-5" /> Sign In
          </button>
        )}
        <button onClick={() => navigate("/privacy")} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200">
          <Shield className="w-5 h-5" /> Privacy Policy
        </button>
        <button onClick={() => navigate("/terms")} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200">
          <FileText className="w-5 h-5" /> Terms of Use
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
