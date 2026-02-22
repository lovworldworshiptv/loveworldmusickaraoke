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
    <div className="h-[100dvh] bg-background overflow-hidden safe-top flex flex-col">
      <Sidebar />
      <TopNavbar />
      <main className={`lg:ml-64 flex-1 overflow-x-hidden overflow-y-auto pull-to-refresh ${currentSong ? "pb-44 lg:pb-28" : "pb-20 lg:pb-6"}`}>
        {children}
      </main>
      <PlayerBar />
      <BottomNav />
    </div>
  );
});

AppLayout.displayName = "AppLayout";
export default AppLayout;
