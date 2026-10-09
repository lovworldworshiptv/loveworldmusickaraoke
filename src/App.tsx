import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { FeatureProvider, FeatureRouteGate } from "@/contexts/FeatureContext";
import { PlayerProvider } from "@/contexts/PlayerContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import AdminRouteGate from "@/components/auth/AdminRouteGate";
import AuthGate from "@/components/auth/AuthGate";
import OfflineBanner from "@/components/offline/OfflineBanner";
import Index from "./pages/Index";
import Library from "./pages/Library";
import Games from "./pages/Games";
import SongMatch from "./pages/SongMatch";
import SongMatchLyrics from "./pages/SongMatchLyrics";
import SongMatchMelody from "./pages/SongMatchMelody";
import SongMatchCategory from "./pages/SongMatchCategory";
import SongMatchArticles from "./pages/SongMatchArticles";
import Auth from "./pages/Auth";
import KingsChatCallback from "./pages/KingsChatCallback";
import KingsChatLogin from "./pages/KingsChatLogin";
import Articles from "./pages/Articles";
import AdminSongs from "./pages/AdminSongs";
import AdminAlbums from "./pages/AdminAlbums";
import AdminArticles from "./pages/AdminArticles";
import AdminCategories from "./pages/AdminCategories";
import AdminPlaylists from "./pages/AdminPlaylists";
import AdminBanners from "./pages/AdminBanners";
import AdminGames from "./pages/AdminGames";
import AdminFeedback from "./pages/AdminFeedback";
import AdminOnboarding from "./pages/AdminOnboarding";
import AdminPremiumAds from "./pages/AdminPremiumAds";
import AdminUsers from "./pages/AdminUsers";
import AdminAnalytics from "./pages/AdminAnalytics";
import AdminPopup from "./pages/AdminPopup";
import AdminNotifications from "./pages/AdminNotifications";
import AdminSubscriptions from "./pages/AdminSubscriptions";
import Referrals from "./pages/Referrals";
import AdminReferralPayouts from "./pages/AdminReferralPayouts";
import AdminKaraokeStories from "./pages/AdminKaraokeStories";
import Profile from "./pages/Profile";
import PublicProfile from "./pages/PublicProfile";
import Community from "./pages/Community";
import Discover from "./pages/Discover";
import History from "./pages/History";
import Playlists from "./pages/Playlists";
import Feedback from "./pages/Feedback";
import Albums from "./pages/Albums";
import Videos from "./pages/Videos";
import Collection from "./pages/Collection";
import Moments from "./pages/Moments";
import StageMode from "./pages/StageMode";
import Studio from "./pages/Studio";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import CategorySongs from "./pages/CategorySongs";
import NotFound from "./pages/NotFound";
import Subscription from "./pages/Subscription";
import Reminders from "./pages/Reminders";
import Challenge from "./pages/Challenge";
import ChallengeEntry from "./pages/ChallengeEntry";
import ChallengeReferrals from "./pages/ChallengeReferrals";
import AdminChallenges from "./pages/AdminChallenges";
import AdminAppearance from "./pages/AdminAppearance";
import AdminDiscover from "./pages/AdminDiscover";
import DiscoverTag from "./pages/DiscoverTag";
import DiscoverCollection from "./pages/DiscoverCollection";
import OfflineRedirect from "@/components/offline/OfflineRedirect";
import AppDownloadPrompt from "@/components/share/AppDownloadPrompt";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Offline-first: show what was already loaded instead of erroring
      networkMode: "offlineFirst",
      staleTime: 5 * 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: (count) => navigator.onLine && count < 2,
    },
    mutations: { networkMode: "offlineFirst" },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <OfflineBanner />
        <AppDownloadPrompt />
        <BrowserRouter>
          <AuthProvider>
            <FeatureProvider>
            <PlayerProvider>
              <OfflineRedirect />
              <FeatureRouteGate>
              <Routes>
                {/* Public routes */}
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/auth/kingschat/login" element={<KingsChatLogin />} />
                <Route path="/auth/kingschat/callback" element={<KingsChatCallback />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />

                {/* Protected routes */}
                <Route path="/library" element={<AuthGate><Library /></AuthGate>} />
                <Route path="/games" element={<AuthGate><Games /></AuthGate>} />
                <Route path="/games/songmatch" element={<AuthGate><SongMatch /></AuthGate>} />
                <Route path="/games/songmatch/lyrics" element={<AuthGate><SongMatchLyrics /></AuthGate>} />
                <Route path="/games/songmatch/melody" element={<AuthGate><SongMatchMelody /></AuthGate>} />
                <Route path="/games/songmatch/category" element={<AuthGate><SongMatchCategory /></AuthGate>} />
                <Route path="/games/songmatch/articles" element={<AuthGate><SongMatchArticles /></AuthGate>} />
                <Route path="/games/challenge" element={<AuthGate><Challenge /></AuthGate>} />
                <Route path="/games/challenge/enter" element={<AuthGate><ChallengeEntry /></AuthGate>} />
                <Route path="/games/challenge/referrals" element={<AuthGate><ChallengeReferrals /></AuthGate>} />
                <Route path="/smchallenge" element={<Challenge />} />
                <Route path="/admin/challenges" element={<AdminRouteGate><AdminChallenges /></AdminRouteGate>} />
                <Route path="/articles" element={<AuthGate><Articles /></AuthGate>} />
                <Route path="/profile" element={<AuthGate><Profile /></AuthGate>} />
                <Route path="/user/:userId" element={<PublicProfile />} />
                <Route path="/discover" element={<AuthGate><Discover /></AuthGate>} />
                <Route path="/discover/tag/:tag" element={<AuthGate><DiscoverTag /></AuthGate>} />
                <Route path="/discover/music" element={<AuthGate><DiscoverCollection kind="music" /></AuthGate>} />
                <Route path="/discover/karaoke" element={<AuthGate><DiscoverCollection kind="karaoke" /></AuthGate>} />
                <Route path="/discover/videos" element={<AuthGate><DiscoverCollection kind="videos" /></AuthGate>} />
                <Route path="/discover/featured/:id" element={<AuthGate><DiscoverCollection kind="featured" /></AuthGate>} />
                <Route path="/history" element={<AuthGate><History /></AuthGate>} />
                <Route path="/playlists" element={<AuthGate><Playlists /></AuthGate>} />
                <Route path="/feedback" element={<AuthGate><Feedback /></AuthGate>} />
                <Route path="/albums" element={<AuthGate><Albums /></AuthGate>} />
                <Route path="/videos" element={<AuthGate><Videos /></AuthGate>} />
                <Route path="/collection/:id" element={<Collection />} />
                <Route path="/moments" element={<AuthGate><Moments /></AuthGate>} />
                <Route path="/community" element={<AuthGate><Community /></AuthGate>} />
                <Route path="/community/:communityId" element={<AuthGate><Community /></AuthGate>} />
                <Route path="/stage" element={<AuthGate><StageMode /></AuthGate>} />
                <Route path="/studio" element={<Studio />} />
                <Route path="/category/:id" element={<AuthGate><CategorySongs /></AuthGate>} />
                <Route path="/subscription" element={<AuthGate><Subscription /></AuthGate>} />
                <Route path="/reminders" element={<AuthGate><Reminders /></AuthGate>} />
                <Route path="/admin/songs" element={<AdminRouteGate allowEditor><AdminSongs /></AdminRouteGate>} />
                <Route path="/admin/albums" element={<AdminRouteGate><AdminAlbums /></AdminRouteGate>} />
                <Route path="/admin/articles" element={<AdminRouteGate><AdminArticles /></AdminRouteGate>} />
                <Route path="/admin/categories" element={<AdminRouteGate><AdminCategories /></AdminRouteGate>} />
                <Route path="/admin/playlists" element={<AdminRouteGate><AdminPlaylists /></AdminRouteGate>} />
                <Route path="/admin/banners" element={<AdminRouteGate><AdminBanners /></AdminRouteGate>} />
                <Route path="/admin/games" element={<AdminRouteGate><AdminGames /></AdminRouteGate>} />
                <Route path="/admin/feedback" element={<AdminRouteGate><AdminFeedback /></AdminRouteGate>} />
                <Route path="/admin/onboarding" element={<AdminRouteGate><AdminOnboarding /></AdminRouteGate>} />
                <Route path="/admin/premium-ads" element={<AdminRouteGate><AdminPremiumAds /></AdminRouteGate>} />
                <Route path="/admin/users" element={<AdminRouteGate><AdminUsers /></AdminRouteGate>} />
                <Route path="/admin/analytics" element={<AdminRouteGate><AdminAnalytics /></AdminRouteGate>} />
                <Route path="/admin/popup" element={<AdminRouteGate><AdminPopup /></AdminRouteGate>} />
                <Route path="/admin/notifications" element={<AdminRouteGate><AdminNotifications /></AdminRouteGate>} />
                <Route path="/admin/subscriptions" element={<AdminRouteGate><AdminSubscriptions /></AdminRouteGate>} />
                <Route path="/admin/referral-payouts" element={<AdminRouteGate><AdminReferralPayouts /></AdminRouteGate>} />
                <Route path="/referrals" element={<AuthGate><Referrals /></AuthGate>} />
                <Route path="/admin/karaoke-stories" element={<AdminRouteGate><AdminKaraokeStories /></AdminRouteGate>} />
                <Route path="/admin/appearance" element={<AdminRouteGate><AdminAppearance /></AdminRouteGate>} />
                <Route path="/admin/discover" element={<AdminRouteGate allowEditor><AdminDiscover /></AdminRouteGate>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </FeatureRouteGate>
            </PlayerProvider>
            </FeatureProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
