import { useNavigate, useLocation } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

const TopNavbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === "/";

  return (
    <header className="sticky top-0 z-40 glass border-b border-border px-4 py-3 flex items-center lg:ml-64">
      <div className="flex items-center gap-2">
        {!isHome && (
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors active:scale-95"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <h1 className="text-lg font-serif gradient-gold-text font-bold lg:hidden">Loveworld Music</h1>
      </div>
    </header>
  );
};

export default TopNavbar;
