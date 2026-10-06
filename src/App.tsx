import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { PlayerProvider } from "@/contexts/PlayerContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
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
import AdminKaraokeStories from "./pages/AdminKaraokeStories";
import Profile from "./pages/Profile";
import PublicProfile from "./pages/PublicProfile";
import Discover from "./pages/Discover";
import History from "./pages/History";
import Playlists from "./pages/Playlists";
import Feedback from "./pages/Feedback";
import Albums from "./pages/Albums";
import Videos from "./pages/Videos";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <OfflineBanner />
        <BrowserRouter>
          <AuthProvider>
            <PlayerProvider>
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
                <Route path="/admin/challenges" element={<AuthGate><AdminChallenges /></AuthGate>} />
                <Route path="/articles" element={<AuthGate><Articles /></AuthGate>} />
                <Route path="/profile" element={<AuthGate><Profile /></AuthGate>} />
                <Route path="/user/:userId" element={<PublicProfile />} />
                <Route path="/discover" element={<AuthGate><Discover /></AuthGate>} />
                <Route path="/history" element={<AuthGate><History /></AuthGate>} />
                <Route path="/playlists" element={<AuthGate><Playlists /></AuthGate>} />
                <Route path="/feedback" element={<AuthGate><Feedback /></AuthGate>} />
                <Route path="/albums" element={<AuthGate><Albums /></AuthGate>} />
                <Route path="/videos" element={<AuthGate><Videos /></AuthGate>} />
                <Route path="/moments" element={<AuthGate><Moments /></AuthGate>} />
                <Route path="/stage" element={<AuthGate><StageMode /></AuthGate>} />
                <Route path="/studio" element={<Studio />} />
                <Route path="/category/:id" element={<AuthGate><CategorySongs /></AuthGate>} />
                <Route path="/subscription" element={<AuthGate><Subscription /></AuthGate>} />
                <Route path="/reminders" element={<AuthGate><Reminders /></AuthGate>} />
                <Route path="/admin/songs" element={<AuthGate><AdminSongs /></AuthGate>} />
                <Route path="/admin/albums" element={<AuthGate><AdminAlbums /></AuthGate>} />
                <Route path="/admin/articles" element={<AuthGate><AdminArticles /></AuthGate>} />
                <Route path="/admin/categories" element={<AuthGate><AdminCategories /></AuthGate>} />
                <Route path="/admin/playlists" element={<AuthGate><AdminPlaylists /></AuthGate>} />
                <Route path="/admin/banners" element={<AuthGate><AdminBanners /></AuthGate>} />
                <Route path="/admin/games" element={<AuthGate><AdminGames /></AuthGate>} />
                <Route path="/admin/feedback" element={<AuthGate><AdminFeedback /></AuthGate>} />
                <Route path="/admin/onboarding" element={<AuthGate><AdminOnboarding /></AuthGate>} />
                <Route path="/admin/premium-ads" element={<AuthGate><AdminPremiumAds /></AuthGate>} />
                <Route path="/admin/users" element={<AuthGate><AdminUsers /></AuthGate>} />
                <Route path="/admin/analytics" element={<AuthGate><AdminAnalytics /></AuthGate>} />
                <Route path="/admin/popup" element={<AuthGate><AdminPopup /></AuthGate>} />
                <Route path="/admin/notifications" element={<AuthGate><AdminNotifications /></AuthGate>} />
                <Route path="/admin/subscriptions" element={<AuthGate><AdminSubscriptions /></AuthGate>} />
                <Route path="/admin/karaoke-stories" element={<AuthGate><AdminKaraokeStories /></AuthGate>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </PlayerProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
