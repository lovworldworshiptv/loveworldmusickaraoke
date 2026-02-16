import { Home, Library, Clock, Podcast, ListMusic, MessageSquare, LogOut, Shield, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: Home, label: "Home", active: true },
  { icon: Library, label: "My Library" },
  { icon: Clock, label: "History" },
  { icon: Podcast, label: "Podcast" },
  { icon: ListMusic, label: "Playlist" },
  { icon: MessageSquare, label: "Feedback" },
];

const bottomItems = [
  { icon: LogOut, label: "Sign Out", danger: true },
  { icon: Shield, label: "Privacy Policy" },
  { icon: FileText, label: "Terms of Use" },
];

const Sidebar = () => {
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
            className={cn(
              "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
              item.active
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
        {bottomItems.map((item) => (
          <button
            key={item.label}
            className={cn(
              "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
              item.danger
                ? "text-destructive hover:bg-destructive/10"
                : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </button>
        ))}
      </div>
    </aside>
  );
};

export default Sidebar;
