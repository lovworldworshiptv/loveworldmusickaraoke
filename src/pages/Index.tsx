import { useState, useEffect } from "react";
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
import LazySection from "@/components/home/LazySection";
import OnboardingSplash from "@/components/onboarding/OnboardingSplash";
import { useAuth } from "@/contexts/AuthContext";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

const Index = () => {
  const { username } = useAuth();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [mood, setMood] = useState<Mood>({ id: null, name: "For You" });

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
      <MoodCapsules value={mood.id} onChange={setMood} />
      <HeroBanner />
      <QuickPicks moodId={mood.id} moodName={mood.id ? mood.name : undefined} />
      <AlbumSection />
      <KaraokeStories />
      <DailyDiscover />
      <SongSection title="Featured Songs" />
      <SecondaryBanner />
      <LazySection><CategorySection /></LazySection>
      <LazySection><GlobalPlaylistsSection /></LazySection>
      <LazySection><RecentlyPlayed /></LazySection>
      <LazySection><ArticleSection /></LazySection>

      <div className="h-8" />
    </AppLayout>
  );
};

export default Index;
