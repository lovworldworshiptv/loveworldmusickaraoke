import { WifiOff, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const OfflineScreen = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
      <div className="w-28 h-28 rounded-full bg-muted flex items-center justify-center mb-6">
        <WifiOff className="w-12 h-12 text-muted-foreground" />
      </div>
      <h2 className="text-2xl font-serif font-bold text-foreground mb-2">You're Offline</h2>
      <p className="text-sm text-muted-foreground mb-8 max-w-xs leading-relaxed">
        No internet connection detected. You can still listen to your downloaded tracks!
      </p>
      <Button
        onClick={() => navigate("/library?tab=downloads")}
        className="gradient-gold text-primary-foreground gap-2"
      >
        <Download className="w-4 h-4" /> See Downloads
      </Button>
    </div>
  );
};

export default OfflineScreen;
