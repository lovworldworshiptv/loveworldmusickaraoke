import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import HeroBanner from "@/components/home/HeroBanner";
import SongSection from "@/components/home/SongSection";
import AlbumSection from "@/components/home/AlbumSection";
import CategorySection from "@/components/home/CategorySection";
import ArticleSection from "@/components/home/ArticleSection";
import GameSection from "@/components/home/GameSection";
import SecondaryBanner from "@/components/home/SecondaryBanner";
import RecentlyPlayed from "@/components/home/RecentlyPlayed";
import OnboardingSplash from "@/components/onboarding/OnboardingSplash";
import { useAuth } from "@/contexts/AuthContext";
import ProfileMenu from "@/components/layout/ProfileMenu";

const Index = () => {
  const { username } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem("onboarding_completed");
    if (!seen) setShowOnboarding(true);
  }, []);

  const handleOnboardingComplete = () => {
    localStorage.setItem("onboarding_completed", "true");
    setShowOnboarding(false);
  };

  if (showOnboarding) {
    return <OnboardingSplash onComplete={handleOnboardingComplete} />;
  }

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 lg:pt-6 animate-fade-in-up flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground tracking-wide">Welcome Esteemed</p>
          <h1 className="text-2xl font-serif font-bold gradient-gold-text">{username}</h1>
        </div>
        <ProfileMenu />
      </div>

      {/* PRD Order: Hero → Top Albums → Featured Songs → Secondary Banner → Categories → Recently Played → Articles → Games */}
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