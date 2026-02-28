import { useNavigate, useLocation } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import logo from "@/assets/logo.png";
import NotificationCenter from "@/components/notifications/NotificationCenter";
import ProfileMenu from "@/components/layout/ProfileMenu";
import { useAuth } from "@/contexts/AuthContext";

const TopNavbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === "/";
  const { username } = useAuth();

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
        {isHome ? (
          <div>
            <p className="text-sm text-muted-foreground tracking-wide">Welcome Esteemed</p>
            <h1 className="text-lg font-serif font-bold gradient-gold-text leading-tight">{username}</h1>
          </div>
        ) : (
          <img src={logo} alt="Loveworld Music Karaoke+" className="h-9 w-auto lg:hidden" />
        )}
      </div>
      <div className="flex items-center gap-1">
        <NotificationCenter />
        {isHome && <ProfileMenu />}
      </div>
    </header>
  );
};

export default TopNavbar;
