import { Home, BookOpen, Library, Gamepad2, User } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: Home, label: "Home", active: true },
  { icon: BookOpen, label: "Articles" },
  { icon: Library, label: "My Library" },
  { icon: Gamepad2, label: "Trivial" },
  { icon: User, label: "You" },
];

const BottomNav = () => {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 glass border-t border-border">
      <div className="flex items-center justify-around py-2 pb-[env(safe-area-inset-bottom)]">
        {navItems.map((item) => (
          <button
            key={item.label}
            className={cn(
              "flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-all duration-200",
              item.active ? "text-gold" : "text-muted-foreground"
            )}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};

export default BottomNav;
