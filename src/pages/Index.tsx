import AppLayout from "@/components/layout/AppLayout";
import HeroBanner from "@/components/home/HeroBanner";
import SongSection from "@/components/home/SongSection";
import CategorySection from "@/components/home/CategorySection";
import ArticleSection from "@/components/home/ArticleSection";
import GameSection from "@/components/home/GameSection";
import SecondaryBanner from "@/components/home/SecondaryBanner";
import RecentlyPlayed from "@/components/home/RecentlyPlayed";
import { topSongs, featuredSongs } from "@/data/mockData";
import { useAuth } from "@/contexts/AuthContext";

const Index = () => {
  const { username } = useAuth();

  return (
    <AppLayout>
      <div className="px-4 lg:px-6 pt-4 lg:pt-6">
        <p className="text-sm text-muted-foreground">Welcome Esteemed</p>
        <h1 className="text-2xl font-serif font-bold gradient-gold-text">{username}</h1>
      </div>

      {/* PRD Order: Hero → Top Songs → Featured Songs → Secondary Banner (4th) → Categories → Recently Played → Articles → Games */}
      <HeroBanner />
      <SongSection title="Top Songs" songs={topSongs} />
      <SongSection title="Featured Songs" songs={featuredSongs} />
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
