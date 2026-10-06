import { Home, Library, Clock, ListMusic, MessageSquare, LogOut, Shield, FileText, BookOpen, Music2, Newspaper, Grid3X3, Disc3, List, Image, Gamepad2, Sparkles, Users, BarChart3, Bell, Crown, Compass, Mic2, AlarmClock, Trophy, Clapperboard, HardDrive, Film, Presentation, Palette, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import logo from "@/assets/logo.png";
import { cn } from "@/lib/utils";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useIsEditor } from "@/hooks/useIsEditor";
import { Button } from "@/components/ui/button";

const navItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Compass, label: "Discover", path: "/discover" },
  { icon: BookOpen, label: "Articles", path: "/articles" },
  { icon: Library, label: "My Library", path: "/library" },
  { icon: Gamepad2, label: "Games", path: "/games" },
  { icon: Disc3, label: "Albums", path: "/albums" },
  { icon: Clapperboard, label: "Videos", path: "/videos" },
  { icon: Film, label: "Moments", path: "/moments" },
  { icon: Users, label: "Community", path: "/community" },
  { icon: Presentation, label: "Stage Mode", path: "/stage" },
  { icon: HardDrive, label: "My Studio", path: "/studio" },
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
  { icon: Palette, label: "Appearance & Home", path: "/admin/appearance" },
];

interface SidebarProps {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

const Sidebar = ({ collapsed, onCollapsedChange }: SidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { isEditor } = useIsEditor();

  return (
    <aside className={cn("hidden lg:flex flex-col h-screen bg-sidebar border-r border-sidebar-border fixed left-0 top-0 z-30 transition-[width] duration-300", collapsed ? "w-20" : "w-64")}>
      <div className={cn("h-[88px] flex items-center", collapsed ? "justify-center px-3" : "justify-between px-6")}>
        {!collapsed && <img src={logo} alt="Loveworld Music Karaoke+" className="h-10 w-auto min-w-0" />}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onCollapsedChange(!collapsed)}
          aria-label={collapsed ? "Open sidebar" : "Close sidebar"}
          title={collapsed ? "Open sidebar" : "Close sidebar"}
          className="shrink-0 text-sidebar-foreground hover:bg-sidebar-accent hover:text-gold"
        >
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </Button>
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <button
            key={item.label}
            onClick={() => navigate(item.path)}
            className={cn(
              "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
              collapsed && "justify-center",
              location.pathname === item.path
                ? "bg-sidebar-accent text-gold"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <item.icon className="w-5 h-5" />
            {!collapsed && item.label}
          </button>
        ))}

        {(isAdmin || isEditor) && (
          <>
            <div className={cn("pt-4 pb-1 px-3", collapsed && "border-t border-sidebar-border mt-3")}>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                {collapsed ? "" : isAdmin ? "Admin" : "Editor"}
              </p>
            </div>
            {(isAdmin ? adminItems : [{ icon: Music2, label: "Manage Songs", path: "/admin/songs" }]).map((item) => (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                className={cn(
                  "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                  collapsed && "justify-center",
                  location.pathname === item.path
                    ? "bg-sidebar-accent text-gold"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="w-5 h-5" />
                {!collapsed && item.label}
              </button>
            ))}
          </>
        )}
      </nav>

      <div className="px-3 pb-6 space-y-1">
        {user ? (
          <button onClick={() => signOut()}
            className={cn("flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-all duration-200", collapsed && "justify-center")}>
            <LogOut className="w-5 h-5" /> {!collapsed && "Sign Out"}
          </button>
        ) : (
          <button onClick={() => navigate("/auth")}
            className={cn("flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gold hover:bg-sidebar-accent transition-all duration-200", collapsed && "justify-center")}>
            <LogOut className="w-5 h-5" /> {!collapsed && "Sign In"}
          </button>
        )}
        <button onClick={() => navigate("/privacy")} className={cn("flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200", collapsed && "justify-center")}>
          <Shield className="w-5 h-5" /> {!collapsed && "Privacy Policy"}
        </button>
        <button onClick={() => navigate("/terms")} className={cn("flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200", collapsed && "justify-center")}>
          <FileText className="w-5 h-5" /> {!collapsed && "Terms of Use"}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
