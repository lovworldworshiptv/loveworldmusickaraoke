import { ReactNode, memo } from "react";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import PlayerBar from "../player/PlayerBar";

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout = memo(({ children }: AppLayoutProps) => {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden safe-top">
      <Sidebar />
      <main className="lg:ml-64 pb-36 lg:pb-24 overflow-x-hidden pull-to-refresh">
        {children}
      </main>
      <PlayerBar />
      <BottomNav />
    </div>
  );
});

AppLayout.displayName = "AppLayout";
export default AppLayout;
