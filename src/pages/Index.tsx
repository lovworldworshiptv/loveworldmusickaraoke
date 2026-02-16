import AppLayout from "@/components/layout/AppLayout";
import HeroBanner from "@/components/home/HeroBanner";
import SongSection from "@/components/home/SongSection";
import CategorySection from "@/components/home/CategorySection";
import ArticleSection from "@/components/home/ArticleSection";
import GameSection from "@/components/home/GameSection";
import { topSongs, featuredSongs } from "@/data/mockData";

const Index = () => {
  return (
    <AppLayout>
      {/* Welcome Header */}
      <div className="px-4 lg:px-6 pt-4 lg:pt-6">
        <p className="text-sm text-muted-foreground">Welcome Esteemed</p>
        <h1 className="text-2xl font-serif font-bold gradient-gold-text">Guest</h1>
      </div>

      <HeroBanner />
      <SongSection title="Top Songs" songs={topSongs} />
      <CategorySection />
      <SongSection title="Featured Songs" songs={featuredSongs} />
      <ArticleSection />
      <GameSection />

      {/* Bottom spacer */}
      <div className="h-8" />
    </AppLayout>
  );
};

export default Index;
