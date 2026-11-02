import { useFeatures } from "@/contexts/FeatureContext";
import { HOME_FEATURES } from "@/lib/featureFlags";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import HeroBanner from "@/components/home/HeroBanner";
import FreeDownloads from "@/components/home/FreeDownloads";
import KaraokeStories from "@/components/home/KaraokeStories";
import SongSection from "@/components/home/SongSection";
import AlbumSection from "@/components/home/AlbumSection";
import GlobalPlaylistsSection from "@/components/home/GlobalPlaylistsSection";
import CategorySection from "@/components/home/CategorySection";
import ArticleSection from "@/components/home/ArticleSection";

import SecondaryBanner from "@/components/home/SecondaryBanner";
import RecentlyPlayed from "@/components/home/RecentlyPlayed";
import HomepagePopup from "@/components/home/HomepagePopup";
import RenewalBanner from "@/components/home/RenewalBanner";
import MoodCapsules, { type Mood } from "@/components/home/MoodCapsules";
import QuickPicks from "@/components/home/QuickPicks";
import DailyDiscover from "@/components/home/DailyDiscover";
import PlatformRecommendations from "@/components/home/PlatformRecommendations";
import ModeSongRail from "@/components/home/ModeSongRail";
import HomeSlot from "@/components/home/HomeSlot";
import OnboardingSplash from "@/components/onboarding/OnboardingSplash";
import { useSetting, resolveHomeLayout, SETTING_KEYS, type HomeSectionSetting } from "@/lib/siteSettings";
import { useAuth } from "@/contexts/AuthContext";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { hasAuthCallback } from "@/lib/emailLink";

const Index = () => {
  const { enabled, loading: featuresLoading } = useFeatures();
  const { username } = useAuth();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [mood, setMood] = useState<Mood>({ id: null, name: "For You" });

  const savedLayout = useSetting<HomeSectionSetting[]>(SETTING_KEYS.homeLayout);
  const layout = resolveHomeLayout(savedLayout);
  // Wait for the admin's order and feature switches so sections never reshuffle or vanish after showing.
  const layoutReady = savedLayout !== undefined && !featuresLoading;

  useEffect(() => {
    // Older confirmation emails land here: hand them to the confirm page instead of the welcome slides.
    if (hasAuthCallback(window.location.search, window.location.hash)) {
      navigate(`/auth/confirm${window.location.search}${window.location.hash}`, { replace: true });
      return;
    }
    const seen = localStorage.getItem("onboarding_completed");
    if (!seen) setShowOnboarding(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Offline fallback to Downloads is handled globally by OfflineRedirect.
  void isOnline;

  const handleOnboardingComplete = () => {
    localStorage.setItem("onboarding_completed", "true");
    setShowOnboarding(false);
  };

  if (showOnboarding) {
    return <OnboardingSplash onComplete={handleOnboardingComplete} />;
  }

  return (
    <AppLayout>
      <HomepagePopup />
      <RenewalBanner />
      {!layoutReady && (
        <div aria-hidden className="px-4 lg:px-6 pt-4 lg:pt-6 space-y-8">
          <div className="w-full aspect-video rounded-2xl bg-muted/30 animate-pulse" />
          {[0, 1, 2].map((i) => <div key={i} className="h-52 rounded-2xl bg-muted/30 animate-pulse" />)}
        </div>
      )}
      {layoutReady && layout.filter((x) => x.visible && (!HOME_FEATURES[x.id] || enabled(HOME_FEATURES[x.id]))).map((x) => {
        const node = ({
          moods: <MoodCapsules value={mood.id} onChange={setMood} />,
          hero: <HeroBanner />,
          free_downloads: <FreeDownloads />,
          quick_picks: <QuickPicks moodId={mood.id} moodName={mood.id ? mood.name : undefined} />,
          recommendations: <PlatformRecommendations />,
          albums: <AlbumSection />,
          stories: <KaraokeStories />,
          daily_discover: <DailyDiscover />,
          featured: <SongSection title="Featured Songs" />,
          videos: <ModeSongRail mode="video" eyebrow="Watch & worship" title="Music Videos For You" />,
          secondary_banner: <SecondaryBanner />,
          karaoke: <ModeSongRail mode="karaoke" eyebrow="Sing along" title="Soundtrack For Your Day" />,
          categories: <CategorySection />,
          global_playlists: <GlobalPlaylistsSection />,
          recent: <RecentlyPlayed />,
          articles: <ArticleSection />,
        } as Record<string, JSX.Element>)[x.id];
        return node ? <HomeSlot key={x.id} id={x.id}>{node}</HomeSlot> : null;
      })}

      <div className="h-8" />
    </AppLayout>
  );
};

export default Index;
