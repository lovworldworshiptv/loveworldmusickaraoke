import { useState, useEffect, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import HeroBanner from "@/components/home/HeroBanner";
import KaraokeStories from "@/components/home/KaraokeStories";
import SongSection from "@/components/home/SongSection";
import AlbumSection from "@/components/home/AlbumSection";
import GlobalPlaylistsSection from "@/components/home/GlobalPlaylistsSection";
import CategorySection from "@/components/home/CategorySection";
import ArticleSection from "@/components/home/ArticleSection";

import SecondaryBanner from "@/components/home/SecondaryBanner";
import RecentlyPlayed from "@/components/home/RecentlyPlayed";
import HomepagePopup from "@/components/home/HomepagePopup";
import MoodCapsules, { type Mood } from "@/components/home/MoodCapsules";
import QuickPicks from "@/components/home/QuickPicks";
import DailyDiscover from "@/components/home/DailyDiscover";
import PlatformRecommendations from "@/components/home/PlatformRecommendations";
import ModeSongRail from "@/components/home/ModeSongRail";
import LazySection from "@/components/home/LazySection";
import OnboardingSplash from "@/components/onboarding/OnboardingSplash";
import { useSetting, resolveHomeLayout, SETTING_KEYS, type HomeSectionSetting } from "@/lib/siteSettings";
import { useAuth } from "@/contexts/AuthContext";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

const Index = () => {
  const { username } = useAuth();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [mood, setMood] = useState<Mood>({ id: null, name: "For You" });

  const layout = resolveHomeLayout(useSetting<HomeSectionSetting[]>(SETTING_KEYS.homeLayout));

  useEffect(() => {
    const seen = localStorage.getItem("onboarding_completed");
    if (!seen) setShowOnboarding(true);
  }, []);

  useEffect(() => {
    if (!isOnline) {
      navigate("/library?tab=downloads", { replace: true });
    }
  }, [isOnline, navigate]);

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
      {layout.filter((x) => x.visible).map((x) => {
        const node = ({
          moods: <MoodCapsules value={mood.id} onChange={setMood} />,
          hero: <HeroBanner />,
          quick_picks: <QuickPicks moodId={mood.id} moodName={mood.id ? mood.name : undefined} />,
          recommendations: <PlatformRecommendations />,
          albums: <AlbumSection />,
          stories: <KaraokeStories />,
          daily_discover: <DailyDiscover />,
          featured: <SongSection title="Featured Songs" />,
          videos: <ModeSongRail mode="video" eyebrow="Watch & worship" title="Music Videos For You" />,
          secondary_banner: <SecondaryBanner />,
          karaoke: <ModeSongRail mode="karaoke" eyebrow="Sing along" title="Soundtrack For Your Day" />,
          categories: <LazySection><CategorySection /></LazySection>,
          global_playlists: <LazySection><GlobalPlaylistsSection /></LazySection>,
          recent: <LazySection><RecentlyPlayed /></LazySection>,
          articles: <LazySection><ArticleSection /></LazySection>,
        } as Record<string, JSX.Element>)[x.id];
        return node ? <Fragment key={x.id}>{node}</Fragment> : null;
      })}

      <div className="h-8" />
    </AppLayout>
  );
};

export default Index;
