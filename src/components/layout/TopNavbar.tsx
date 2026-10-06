import { useNavigate, useLocation } from "react-router-dom";
import { ChevronLeft, Search, Crown } from "lucide-react";
import logo from "@/assets/logo.png";
import NotificationCenter from "@/components/notifications/NotificationCenter";
import ProfileMenu from "@/components/layout/ProfileMenu";
import GlobalSearch from "@/components/search/GlobalSearch";
import { useAuth } from "@/contexts/AuthContext";
import { useIsPremium } from "@/hooks/useIsPremium";
import { useState } from "react";

const TopNavbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === "/";
  const { username, user } = useAuth();
  const { isPremium, isTrial } = useIsPremium();
  const [searchOpen, setSearchOpen] = useState(false);
  const isFreeUser = user && !isPremium && !isTrial;

  return (
    <>
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
            <p className="text-sm text-white tracking-wide">Welcome Esteemed</p>
            <h1 className="text-lg font-serif font-bold gradient-gold-text leading-tight">{username}</h1>
          </div>
        ) : (
          <img src={logo} alt="Loveworld Music Karaoke+" className="h-9 w-auto lg:hidden" />
        )}
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => setSearchOpen(true)} className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <Search className="w-5 h-5" />
        </button>
        <NotificationCenter />
        {isHome && <ProfileMenu />}
      </div>
    </header>
    <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    {isFreeUser && (
      <button
        onClick={() => navigate("/subscription")}
        className="sticky top-[57px] z-30 w-full lg:ml-64 flex items-center justify-center gap-2 px-4 py-2 gradient-gold text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
      >
        <Crown className="w-3.5 h-3.5" /> Upgrade to Premium — Unlock downloads, karaoke & more
      </button>
    )}
    </>
  );
};

export default TopNavbar;
