import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";

// Eager load critical pages (sidebar nav + auth)
import Auth from "./pages/Auth";
import LinkBio from "./pages/LinkBio";
import Dashboard from "./pages/Index";
import Clients from "./pages/Clients";
import Financial from "./pages/Financial";
import CalendarPage from "./pages/Calendar";
import Settings from "./pages/Settings";
import SchedulingSettings from "./pages/SchedulingSettings";
import ContentManager from "./pages/ContentManager";
import LinkBioManager from "./pages/LinkBioManager";
import Forms from "./pages/Forms";
import Tasks from "./pages/Tasks";

// Lazy load detail/secondary pages only
const Checkin = lazy(() => import("./pages/Checkin"));
const CheckinFormBuilder = lazy(() => import("./pages/CheckinFormBuilder"));
const AnamneseFormBuilder = lazy(() => import("./pages/AnamneseFormBuilder"));
const PublicCheckinForm = lazy(() => import("./pages/PublicCheckinForm"));
const PublicAnamneseForm = lazy(() => import("./pages/PublicAnamneseForm"));
const AthleteDashboard = lazy(() => import("./pages/AthleteDashboard"));
const AthleteDynamicAnamneseForm = lazy(() => import("./pages/AthleteDynamicAnamneseForm"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AthleteAnalysis = lazy(() => import("./pages/AthleteAnalysis"));
const AthleteHistory = lazy(() => import("./pages/AthleteHistory"));
const CheckinReview = lazy(() => import("./pages/CheckinReview"));
const PublicBooking = lazy(() => import("./pages/PublicBooking"));
const PublicBookingConsult = lazy(() => import("./pages/PublicBookingConsult"));
const QuestionBank = lazy(() => import("./pages/QuestionBank"));
const AppointmentDetail = lazy(() => import("./pages/AppointmentDetail"));
const AnamneseResponseDetail = lazy(() => import("./pages/AnamneseResponseDetail"));
const PlansLanding = lazy(() => import("./pages/PlansLanding"));
const ClientDetail = lazy(() => import("./pages/ClientDetail"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
      refetchOnWindowFocus: false,
    },
  },
});

// Compact loading spinner
const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, loading } = useAuth();
  const { role, isLoading: roleLoading } = useUserRole();

  // Only wait for auth, not role, for initial render
  if (loading) {
    return <PageLoader />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // For admin-only routes, wait for role check
  if (adminOnly) {
    if (roleLoading) {
      return <PageLoader />;
    }
    if (role !== 'admin') {
      return <Navigate to="/athlete" replace />;
    }
  }

  return <>{children}</>;
}

function AthleteRoute({ children, allowAdmin = false }: { children: React.ReactNode; allowAdmin?: boolean }) {
  const { user, loading } = useAuth();
  const { role, isLoading: roleLoading } = useUserRole();

  if (loading) {
    return <PageLoader />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Allow admins to view athlete area if allowAdmin is true
  if (!roleLoading && role === 'admin' && !allowAdmin) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<LinkBio />} />
        <Route path="/bio" element={<LinkBio />} />
        <Route path="/plans" element={<PlansLanding />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/form/:formId" element={<PublicCheckinForm />} />
        <Route path="/anamnese-form/:formId" element={<PublicAnamneseForm />} />
        <Route path="/agendar/:slug" element={<PublicBooking />} />
        <Route path="/booking/:token" element={<PublicBookingConsult />} />
        <Route path="/athlete" element={<AthleteRoute allowAdmin><AthleteDashboard /></AthleteRoute>} />
        <Route path="/athlete/anamnese" element={<AthleteRoute allowAdmin><AthleteDynamicAnamneseForm /></AthleteRoute>} />
        <Route path="/admin" element={<ProtectedRoute adminOnly><Dashboard /></ProtectedRoute>} />
        <Route path="/tasks" element={<ProtectedRoute adminOnly><Tasks /></ProtectedRoute>} />
        <Route path="/clients" element={<ProtectedRoute adminOnly><Clients /></ProtectedRoute>} />
        <Route path="/clients/:clientId" element={<ProtectedRoute adminOnly><ClientDetail /></ProtectedRoute>} />
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
        <Route path="/anamnese-response/:responseId" element={<ProtectedRoute adminOnly><AnamneseResponseDetail /></ProtectedRoute>} />
        <Route path="/appointments/:appointmentId" element={<ProtectedRoute adminOnly><AppointmentDetail /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute adminOnly><Settings /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
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
