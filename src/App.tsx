import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import Dashboard from "./pages/Index";
import Clients from "./pages/Clients";
import Financial from "./pages/Financial";
import CalendarPage from "./pages/Calendar";
import Settings from "./pages/Settings";
import Checkin from "./pages/Checkin";
import CheckinFormBuilder from "./pages/CheckinFormBuilder";
import PublicCheckinForm from "./pages/PublicCheckinForm";
import AthleteDashboard from "./pages/AthleteDashboard";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import LandingPage from "./pages/LandingPage";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, loading } = useAuth();
  const { role, isLoading: roleLoading } = useUserRole();

  if (loading || roleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Redirect athletes to their dashboard
  if (role === 'athlete' && adminOnly) {
    return <Navigate to="/athlete" replace />;
  }

  return <>{children}</>;
}

function AthleteRoute({ children, allowAdmin = false }: { children: React.ReactNode; allowAdmin?: boolean }) {
  const { user, loading } = useAuth();
  const { role, isLoading: roleLoading } = useUserRole();

  if (loading || roleLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Allow admins to view athlete area if allowAdmin is true
  if (role === 'admin' && !allowAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/landing" element={<LandingPage />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/form/:formId" element={<PublicCheckinForm />} />
      <Route path="/athlete" element={<AthleteRoute allowAdmin><AthleteDashboard /></AthleteRoute>} />
      <Route path="/" element={<ProtectedRoute adminOnly><Dashboard /></ProtectedRoute>} />
      <Route path="/clients" element={<ProtectedRoute adminOnly><Clients /></ProtectedRoute>} />
      <Route path="/financial" element={<ProtectedRoute adminOnly><Financial /></ProtectedRoute>} />
      <Route path="/calendar" element={<ProtectedRoute adminOnly><CalendarPage /></ProtectedRoute>} />
      <Route path="/checkin" element={<ProtectedRoute adminOnly><Checkin /></ProtectedRoute>} />
      <Route path="/checkin/:formId" element={<ProtectedRoute adminOnly><CheckinFormBuilder /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute adminOnly><Settings /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <div className="dark">
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </div>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
