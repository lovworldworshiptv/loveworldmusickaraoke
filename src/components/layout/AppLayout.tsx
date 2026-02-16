import { ReactNode } from "react";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import PlayerBar from "../player/PlayerBar";

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="lg:ml-64 pb-36 lg:pb-24">
        {children}
      </main>
      <PlayerBar />
      <BottomNav />
    </div>
  );
};

export default AppLayout;
