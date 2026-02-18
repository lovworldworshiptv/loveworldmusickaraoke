import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { PlayerProvider } from "@/contexts/PlayerContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
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
                <Route path="/" element={<Index />} />
                <Route path="/library" element={<Library />} />
                <Route path="/games" element={<Games />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/articles" element={<Articles />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/discover" element={<Discover />} />
                <Route path="/history" element={<History />} />
                <Route path="/playlists" element={<Playlists />} />
                <Route path="/feedback" element={<Feedback />} />
                <Route path="/albums" element={<Albums />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/category/:id" element={<CategorySongs />} />
                <Route path="/admin/songs" element={<AdminSongs />} />
                <Route path="/admin/albums" element={<AdminAlbums />} />
                <Route path="/admin/articles" element={<AdminArticles />} />
                <Route path="/admin/categories" element={<AdminCategories />} />
                <Route path="/admin/playlists" element={<AdminPlaylists />} />
                <Route path="/admin/banners" element={<AdminBanners />} />
                <Route path="/admin/games" element={<AdminGames />} />
                <Route path="/admin/feedback" element={<AdminFeedback />} />
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
