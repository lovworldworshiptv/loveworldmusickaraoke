import { ReactNode, memo, useState } from "react";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import TopNavbar from "./TopNavbar";
import PlayerBar from "../player/PlayerBar";
import { usePlayer } from "@/contexts/PlayerContext";
import { useOneSignalSync } from "@/hooks/useOneSignal";
import { useAuth } from "@/contexts/AuthContext";
import ProfileUpdateModal from "@/components/profile/ProfileUpdateModal";

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout = memo(({ children }: AppLayoutProps) => {
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);
  const { currentSong } = usePlayer();
  const { user, profileCompleted, profileData, markProfileCompleted } = useAuth();
  useOneSignalSync();

  const isKingschatUser = !!(user?.email?.includes("@kingschat."));

  return (
    <div className="h-[100dvh] bg-background overflow-hidden safe-top flex flex-col">
      <Sidebar collapsed={desktopSidebarCollapsed} onCollapsedChange={setDesktopSidebarCollapsed} />
      <TopNavbar desktopSidebarCollapsed={desktopSidebarCollapsed} />
      <main className={`${desktopSidebarCollapsed ? "lg:ml-20" : "lg:ml-64"} flex-1 overflow-x-hidden overflow-y-auto pull-to-refresh transition-[margin] duration-300 ${currentSong ? "pb-44 lg:pb-20" : "pb-20 lg:pb-6"}`}>
        {children}
      </main>
      <PlayerBar desktopSidebarCollapsed={desktopSidebarCollapsed} />
      <BottomNav />
      {user && !profileCompleted && (
        <ProfileUpdateModal
          open={true}
          onComplete={markProfileCompleted}
          userId={user.id}
          userEmail={user.email}
          isKingschatUser={isKingschatUser}
          currentProfile={profileData}
        />
      )}
    </div>
  );
});

AppLayout.displayName = "AppLayout";
export default AppLayout;
