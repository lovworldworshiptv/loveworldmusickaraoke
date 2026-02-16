import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { PlayerProvider } from "@/contexts/PlayerContext";
import Index from "./pages/Index";
import Library from "./pages/Library";
import Games from "./pages/Games";
import Auth from "./pages/Auth";
import Articles from "./pages/Articles";
import AdminSongs from "./pages/AdminSongs";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
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
              <Route path="/admin/songs" element={<AdminSongs />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </PlayerProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
