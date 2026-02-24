import { Home, Compass, Library, Gamepad2, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate, useLocation } from "react-router-dom";
import { memo } from "react";
import { hapticNavigation } from "@/lib/nativeService";

const navItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Compass, label: "Discover", path: "/discover" },
  { icon: BookOpen, label: "Articles", path: "/articles" },
  { icon: Library, label: "Library", path: "/library" },
  { icon: Gamepad2, label: "Trivial", path: "/games" },
];

const BottomNav = memo(() => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 glass border-t border-border safe-left safe-right gpu">
      <div className="flex items-center justify-around py-2" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
        {navItems.map((item) => (
          <button
            key={item.label}
            onClick={() => { hapticNavigation(); navigate(item.path); }}
            className={cn(
              "flex flex-col items-center gap-1 rounded-lg transition-all duration-200 touch-target active:scale-95",
              "px-4 py-2",
              location.pathname === item.path
                ? "text-gold"
                : "text-muted-foreground active:text-foreground"
            )}
          >
            <item.icon className="w-6 h-6" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
});

BottomNav.displayName = "BottomNav";
export default BottomNav;
