import { ReactNode, memo, useState } from "react";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import TopNavbar from "./TopNavbar";
import PlayerBar from "../player/PlayerBar";
import { usePlayer } from "@/contexts/PlayerContext";
import { useOneSignalSync } from "@/hooks/useOneSignal";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePlayerHidden } from "@/lib/playerVisibility";
import ProfileUpdateModal from "@/components/profile/ProfileUpdateModal";

interface AppLayoutProps {
  children: ReactNode;
  mainClassName?: string;
}

const AppLayout = memo(({ children, mainClassName = "" }: AppLayoutProps) => {
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);
  const { currentSong } = usePlayer();
  const { user, profileCompleted, profileData, markProfileCompleted } = useAuth();
  const isMobile = useIsMobile();
  const [playerHidden] = usePlayerHidden();
  useOneSignalSync();

  const isKingschatUser = !!(user?.email?.includes("@kingschat."));

  // When the mini player is tucked away on phones, content drops down so the
  // last cards sit flush above the bottom menu instead of leaving a gap.
  const bottomPadding = !currentSong
    ? "pb-20 lg:pb-6"
    : isMobile && playerHidden
      ? "pb-[calc(7.75rem+env(safe-area-inset-bottom,0px))] lg:pb-[4.25rem]"
      : "pb-[calc(9.25rem+env(safe-area-inset-bottom,0px))] lg:pb-[4.25rem]";

  return (
    <div className="h-[100dvh] bg-background overflow-hidden safe-top flex flex-col">
      <Sidebar collapsed={desktopSidebarCollapsed} onCollapsedChange={setDesktopSidebarCollapsed} />
      <TopNavbar desktopSidebarCollapsed={desktopSidebarCollapsed} />
      <main className={`${mainClassName} ${desktopSidebarCollapsed ? "lg:ml-20" : "lg:ml-64"} flex-1 overflow-x-hidden overflow-y-auto pull-to-refresh transition-[margin,padding] duration-300 ${bottomPadding}`}>
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
