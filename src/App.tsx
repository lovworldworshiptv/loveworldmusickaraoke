import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { PlayerProvider } from "@/contexts/PlayerContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import AuthGate from "@/components/auth/AuthGate";
import Index from "./pages/Index";
import Library from "./pages/Library";
import Games from "./pages/Games";
import Auth from "./pages/Auth";
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
import Profile from "./pages/Profile";
import Discover from "./pages/Discover";
import History from "./pages/History";
import Playlists from "./pages/Playlists";
import Feedback from "./pages/Feedback";
import Albums from "./pages/Albums";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import CategorySongs from "./pages/CategorySongs";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <PlayerProvider>
              <Routes>
                {/* Public routes */}
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />

                {/* Protected routes */}
                <Route path="/library" element={<AuthGate><Library /></AuthGate>} />
                <Route path="/games" element={<AuthGate><Games /></AuthGate>} />
                <Route path="/articles" element={<AuthGate><Articles /></AuthGate>} />
                <Route path="/profile" element={<AuthGate><Profile /></AuthGate>} />
                <Route path="/discover" element={<AuthGate><Discover /></AuthGate>} />
                <Route path="/history" element={<AuthGate><History /></AuthGate>} />
                <Route path="/playlists" element={<AuthGate><Playlists /></AuthGate>} />
                <Route path="/feedback" element={<AuthGate><Feedback /></AuthGate>} />
                <Route path="/albums" element={<AuthGate><Albums /></AuthGate>} />
                <Route path="/category/:id" element={<AuthGate><CategorySongs /></AuthGate>} />
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
