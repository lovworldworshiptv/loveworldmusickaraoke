import { Home, Library, Clock, Podcast, ListMusic, MessageSquare, LogOut, Shield, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Library, label: "My Library", path: "/library" },
  { icon: Clock, label: "History", path: "/history" },
  { icon: Podcast, label: "Podcast", path: "/podcast" },
  { icon: ListMusic, label: "Playlist", path: "/playlists" },
  { icon: MessageSquare, label: "Feedback", path: "/feedback" },
];

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, user } = useAuth();

  return (
    <aside className="hidden lg:flex flex-col w-64 h-screen bg-sidebar border-r border-sidebar-border fixed left-0 top-0 z-30">
      <div className="p-6">
        <h1 className="text-xl font-serif gradient-gold-text font-bold">Loveworld Music</h1>
        <p className="text-xs text-muted-foreground mt-1">Karaoke & Study+</p>
      </div>

      <nav className="flex-1 px-3 space-y-1">
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
        <button className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200">
          <Shield className="w-5 h-5" /> Privacy Policy
        </button>
        <button className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200">
          <FileText className="w-5 h-5" /> Terms of Use
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
