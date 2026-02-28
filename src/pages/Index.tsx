import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import HeroBanner from "@/components/home/HeroBanner";
import SongSection from "@/components/home/SongSection";
import AlbumSection from "@/components/home/AlbumSection";
import CategorySection from "@/components/home/CategorySection";
import ArticleSection from "@/components/home/ArticleSection";
import GameSection from "@/components/home/GameSection";
import SecondaryBanner from "@/components/home/SecondaryBanner";
import RecentlyPlayed from "@/components/home/RecentlyPlayed";
import HomepagePopup from "@/components/home/HomepagePopup";
import OnboardingSplash from "@/components/onboarding/OnboardingSplash";
import { useAuth } from "@/contexts/AuthContext";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

const Index = () => {
  const { username } = useAuth();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem("onboarding_completed");
    if (!seen) setShowOnboarding(true);
  }, []);

  // Redirect to downloads when offline
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

      <HeroBanner />
      <AlbumSection />
      <SongSection title="Featured Songs" />
      <SecondaryBanner />
      <CategorySection />
      <RecentlyPlayed />
      <ArticleSection />
      <GameSection />

      <div className="h-8" />
    </AppLayout>
  );
};

export default Index;
