import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { PlayerProvider } from "@/contexts/PlayerContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import AuthGate from "@/components/auth/AuthGate";
import { lazy, Suspense } from "react";
import Index from "./pages/Index";

// Lazy-load all non-critical routes for smaller initial bundle
const Library = lazy(() => import("./pages/Library"));
const Games = lazy(() => import("./pages/Games"));
const Auth = lazy(() => import("./pages/Auth"));
const Articles = lazy(() => import("./pages/Articles"));
const AdminSongs = lazy(() => import("./pages/AdminSongs"));
const AdminAlbums = lazy(() => import("./pages/AdminAlbums"));
const AdminArticles = lazy(() => import("./pages/AdminArticles"));
const AdminCategories = lazy(() => import("./pages/AdminCategories"));
const AdminPlaylists = lazy(() => import("./pages/AdminPlaylists"));
const AdminBanners = lazy(() => import("./pages/AdminBanners"));
const AdminGames = lazy(() => import("./pages/AdminGames"));
const AdminFeedback = lazy(() => import("./pages/AdminFeedback"));
const AdminOnboarding = lazy(() => import("./pages/AdminOnboarding"));
const Profile = lazy(() => import("./pages/Profile"));
const Discover = lazy(() => import("./pages/Discover"));
const History = lazy(() => import("./pages/History"));
const Playlists = lazy(() => import("./pages/Playlists"));
const Feedback = lazy(() => import("./pages/Feedback"));
const Albums = lazy(() => import("./pages/Albums"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const CategorySongs = lazy(() => import("./pages/CategorySongs"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes garbage collection
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

const LazyFallback = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <PlayerProvider>
              <Suspense fallback={<LazyFallback />}>
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
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </PlayerProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
