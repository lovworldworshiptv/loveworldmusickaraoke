import { ReactNode, memo } from "react";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import TopNavbar from "./TopNavbar";
import PlayerBar from "../player/PlayerBar";
import { usePlayer } from "@/contexts/PlayerContext";

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout = memo(({ children }: AppLayoutProps) => {
  const { currentSong } = usePlayer();

  return (
    <div className="min-h-screen bg-background overflow-x-hidden safe-top">
      <Sidebar />
      <TopNavbar />
      <main className={`lg:ml-64 overflow-x-hidden overflow-y-auto pull-to-refresh ${currentSong ? "pb-44 lg:pb-28" : "pb-20 lg:pb-6"}`}>
        {children}
      </main>
      <PlayerBar />
      <BottomNav />
    </div>
  );
});

AppLayout.displayName = "AppLayout";
export default AppLayout;
