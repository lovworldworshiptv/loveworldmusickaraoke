import { Home, Compass, Library, Gamepad2, BookOpen, Plus, ListMusic, Mic2, AlarmClock, Presentation } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate, useLocation } from "react-router-dom";
import { memo, useState } from "react";
import { usePlayer } from "@/contexts/PlayerContext";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";

const navItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Compass, label: "Discover", path: "/discover" },
  { icon: BookOpen, label: "Articles", path: "/articles" },
  { icon: Library, label: "Library", path: "/library" },
  { icon: Gamepad2, label: "Games", path: "/games" },
];

const createItems = [
  { icon: ListMusic, label: "Playlist", path: "/playlists" },
  { icon: Mic2, label: "Studio Mode", path: "/studio" },
  { icon: AlarmClock, label: "Reminders", path: "/reminders" },
  { icon: Presentation, label: "Stage Mode", path: "/stage" },
];

const BottomNav = memo(() => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isExpanded } = usePlayer();
  const [createOpen, setCreateOpen] = useState(false);
  const createActive = createItems.some((item) => location.pathname === item.path);

  const openCreateDestination = (path: string) => {
    setCreateOpen(false);
    navigate(path);
  };

  return (
    <nav className={cn(
      "lg:hidden fixed bottom-0 left-0 right-0 z-40 glass border-t border-border safe-left safe-right gpu transition-transform duration-300",
      isExpanded && "translate-y-full pointer-events-none"
    )}>
      <div className="flex items-center justify-around py-2" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
        {navItems.map((item) => (
          <Button
            key={item.label}
            variant="ghost"
            onClick={() => navigate(item.path)}
            className={cn(
              "h-auto min-w-0 flex-1 flex-col gap-1 rounded-lg px-1 py-2 transition-all duration-300 ease-out touch-target active:scale-95 hover:bg-transparent hover:-translate-y-0.5",
              "[&_svg]:!size-6 [&_svg]:transition-all [&_svg]:duration-300",
              location.pathname === item.path
                ? "text-gold hover:[&_svg]:drop-shadow-[0_0_8px_hsl(43_70%_53%/0.6)]"
                : "text-muted-foreground hover:text-foreground active:text-foreground"
            )}
          >
            <item.icon className="w-6 h-6" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Button>
        ))}

        <Drawer open={createOpen} onOpenChange={setCreateOpen}>
          <DrawerTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                "h-auto min-w-0 flex-1 flex-col gap-1 rounded-lg px-1 py-2 transition-all duration-300 ease-out touch-target active:scale-95 hover:bg-transparent hover:-translate-y-0.5",
                createActive || createOpen ? "text-gold" : "text-muted-foreground hover:text-foreground active:text-foreground",
              )}
              aria-label="Open Create menu"
              aria-expanded={createOpen}
            >
              <span className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full bg-gold text-primary-foreground shadow-gold transition-all duration-300 ease-out hover:scale-110 hover:shadow-[0_0_16px_hsl(43_70%_53%/0.55)]",
                createOpen && "rotate-45",
              )}>
                <Plus className="!h-4 !w-4" />
              </span>
              <span className="text-[10px] font-medium">Create</span>
            </Button>
          </DrawerTrigger>
          <DrawerContent className="rounded-t-3xl border-border bg-background/95 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
            <DrawerHeader className="px-0 pb-5 pt-3 text-left">
              <DrawerTitle className="text-xl text-foreground">Create</DrawerTitle>
              <DrawerDescription>Choose what you want to open.</DrawerDescription>
            </DrawerHeader>
            <div className="grid grid-cols-2 gap-3 pb-2">
              {createItems.map((item) => (
                <Button
                  key={item.label}
                  variant="outline"
                  onClick={() => openCreateDestination(item.path)}
                  className={cn(
                    "h-24 flex-col gap-3 rounded-2xl border-border bg-card/70 text-foreground shadow-sm backdrop-blur-md hover:border-gold/50 hover:bg-accent",
                    "[&_svg]:!size-6",
                    location.pathname === item.path && "border-gold/60 bg-gold/10 text-gold",
                  )}
                >
                  <item.icon />
                  <span>{item.label}</span>
                </Button>
              ))}
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </nav>
  );
});

BottomNav.displayName = "BottomNav";
export default BottomNav;
