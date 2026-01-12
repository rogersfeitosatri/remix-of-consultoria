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
import AnamneseFormBuilder from "./pages/AnamneseFormBuilder";
import PublicCheckinForm from "./pages/PublicCheckinForm";
import PublicAnamneseForm from "./pages/PublicAnamneseForm";
import AthleteDashboard from "./pages/AthleteDashboard";
import AthleteDynamicAnamneseForm from "./pages/AthleteDynamicAnamneseForm";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

import Forms from "./pages/Forms";
import AthleteAnalysis from "./pages/AthleteAnalysis";
import AthleteHistory from "./pages/AthleteHistory";
import CheckinReview from "./pages/CheckinReview";
import SchedulingSettings from "./pages/SchedulingSettings";
import PublicBooking from "./pages/PublicBooking";
import PublicBookingConsult from "./pages/PublicBookingConsult";
import ContentManager from "./pages/ContentManager";
import LinkBio from "./pages/LinkBio";
import LinkBioManager from "./pages/LinkBioManager";
import QuestionBank from "./pages/QuestionBank";
import AppointmentDetail from "./pages/AppointmentDetail";
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

  // CRITICAL: Only users with explicit 'admin' role can access admin routes
  // Users without role or with 'athlete' role are redirected to athlete area
  if (adminOnly && role !== 'admin') {
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
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LinkBio />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/form/:formId" element={<PublicCheckinForm />} />
      <Route path="/anamnese-form/:formId" element={<PublicAnamneseForm />} />
      <Route path="/agendar/:slug" element={<PublicBooking />} />
      <Route path="/booking/:token" element={<PublicBookingConsult />} />
      <Route path="/athlete" element={<AthleteRoute allowAdmin><AthleteDashboard /></AthleteRoute>} />
      <Route path="/athlete/anamnese" element={<AthleteRoute allowAdmin><AthleteDynamicAnamneseForm /></AthleteRoute>} />
      <Route path="/admin" element={<ProtectedRoute adminOnly><Dashboard /></ProtectedRoute>} />
      <Route path="/clients" element={<ProtectedRoute adminOnly><Clients /></ProtectedRoute>} />
      <Route path="/financial" element={<ProtectedRoute adminOnly><Financial /></ProtectedRoute>} />
      <Route path="/calendar" element={<ProtectedRoute adminOnly><CalendarPage /></ProtectedRoute>} />
      <Route path="/scheduling" element={<ProtectedRoute adminOnly><SchedulingSettings /></ProtectedRoute>} />
      <Route path="/content" element={<ProtectedRoute adminOnly><ContentManager /></ProtectedRoute>} />
      <Route path="/link-bio" element={<ProtectedRoute adminOnly><LinkBioManager /></ProtectedRoute>} />
      <Route path="/forms" element={<ProtectedRoute adminOnly><Forms /></ProtectedRoute>} />
      <Route path="/question-bank" element={<ProtectedRoute adminOnly><QuestionBank /></ProtectedRoute>} />
      <Route path="/checkin" element={<ProtectedRoute adminOnly><Checkin /></ProtectedRoute>} />
      <Route path="/checkin/:formId" element={<ProtectedRoute adminOnly><CheckinFormBuilder /></ProtectedRoute>} />
      <Route path="/anamnese/:formId" element={<ProtectedRoute adminOnly><AnamneseFormBuilder /></ProtectedRoute>} />
      <Route path="/clients/:clientId/analysis" element={<ProtectedRoute adminOnly><AthleteAnalysis /></ProtectedRoute>} />
      <Route path="/clients/:clientId/history" element={<ProtectedRoute adminOnly><AthleteHistory /></ProtectedRoute>} />
      <Route path="/checkin-review/:responseId" element={<ProtectedRoute adminOnly><CheckinReview /></ProtectedRoute>} />
      <Route path="/appointments/:appointmentId" element={<ProtectedRoute adminOnly><AppointmentDetail /></ProtectedRoute>} />
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
