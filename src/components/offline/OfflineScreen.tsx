import { WifiOff, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";

const OfflineScreen = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center animate-fade-in-up">
      <div className="w-24 h-24 rounded-full bg-muted/50 flex items-center justify-center mb-6">
        <WifiOff className="w-12 h-12 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-serif font-bold text-foreground mb-2">You're Offline</h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-xs">
        No internet connection. You can still listen to your downloaded tracks.
      </p>
      <button
        onClick={() => navigate("/library?tab=downloads")}
        className="flex items-center gap-2 px-6 py-3 rounded-xl gradient-gold text-primary-foreground font-semibold shadow-lg"
      >
        <Download className="w-5 h-5" /> See Downloads
      </button>
    </div>
  );
};

export default OfflineScreen;
