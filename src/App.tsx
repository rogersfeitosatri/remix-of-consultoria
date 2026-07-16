import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Suspense, lazy, useState, useEffect, createContext, useContext } from "react";
import { Loader2 } from "lucide-react";

// Theme context
export const ThemeContext = createContext<{ theme: string; setTheme: (t: string) => void }>({ theme: 'dark', setTheme: () => {} });
export const useThemeToggle = () => useContext(ThemeContext);

// Eager load critical pages (sidebar nav + auth)
import Auth from "./pages/Auth";
import LinkBio from "./pages/LinkBio";
import Dashboard from "./pages/Index";
import Clients from "./pages/Clients";
import Financial from "./pages/Financial";
import CalendarPage from "./pages/Calendar";
import Settings from "./pages/Settings";
import SchedulingSettings from "./pages/SchedulingSettings";
import PeriodicityControl from "./pages/PeriodicityControl";
import ContentManager from "./pages/ContentManager";
import LinkBioManager from "./pages/LinkBioManager";
import Forms from "./pages/Forms";
import Tasks from "./pages/Tasks";
import Adjustments from "./pages/Adjustments";
import NutritionalPeriodization from "./pages/NutritionalPeriodization";
import MetabolicWeb from "./pages/MetabolicWeb";
import StrategicCalls from "./pages/StrategicCalls";
import CallScheduling from "./pages/CallScheduling";
import AiTrainingCenter from "./pages/AiTrainingCenter";

// Eager load frequently accessed detail pages
import AthleteHistory from "./pages/AthleteHistory";
import ClientDetail from "./pages/ClientDetail";
import CheckinReview from "./pages/CheckinReview";

// Lazy load remaining secondary pages
const Checkin = lazy(() => import("./pages/Checkin"));
const CheckinHub = lazy(() => import("./pages/CheckinHub"));
const CheckinFormBuilder = lazy(() => import("./pages/CheckinFormBuilder"));
const AnamneseFormBuilder = lazy(() => import("./pages/AnamneseFormBuilder"));
const PublicCheckinForm = lazy(() => import("./pages/PublicCheckinForm"));
const PublicAnamneseForm = lazy(() => import("./pages/PublicAnamneseForm"));
const AthleteDashboard = lazy(() => import("./pages/AthleteDashboard"));
const AthleteDynamicAnamneseForm = lazy(() => import("./pages/AthleteDynamicAnamneseForm"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AthleteAnalysis = lazy(() => import("./pages/AthleteAnalysis"));
const MealPlans = lazy(() => import("./pages/MealPlans"));
const MealPlanDetail = lazy(() => import("./pages/MealPlanDetail"));
const PublicBooking = lazy(() => import("./pages/PublicBooking"));
const PublicBookingConsult = lazy(() => import("./pages/PublicBookingConsult"));
const QuestionBank = lazy(() => import("./pages/QuestionBank"));
const AppointmentDetail = lazy(() => import("./pages/AppointmentDetail"));
const AnamneseResponseDetail = lazy(() => import("./pages/AnamneseResponseDetail"));
const PlansLanding = lazy(() => import("./pages/PlansLanding"));
const PublicMetabolicScreening = lazy(() => import("./pages/PublicMetabolicScreening"));
const StrategicCallBuilder = lazy(() => import("./pages/StrategicCallBuilder"));
const StrategicCallResponses = lazy(() => import("./pages/StrategicCallResponses"));
const PublicStrategicCall = lazy(() => import("./pages/PublicStrategicCall"));
const CallSchedulingConfig = lazy(() => import("./pages/CallSchedulingConfig"));
const PublicCallBooking = lazy(() => import("./pages/PublicCallBooking"));
const AssessoriaLanding = lazy(() => import("./pages/AssessoriaLanding"));
const AthleteCheckinPlanning = lazy(() => import("./pages/AthleteCheckinPlanning"));
const SchedulingAudit = lazy(() => import("./pages/SchedulingAudit"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const NutriPeriodizaProtocols = lazy(() => import("./pages/NutriPeriodizaProtocols"));
const PublicNpCheckin = lazy(() => import("./pages/PublicNpCheckin"));
const Terms = lazy(() => import("./pages/Terms"));
const PublicOnboarding = lazy(() => import("./pages/PublicOnboarding"));
const ZnAssessoria = lazy(() => import("./pages/ZnAssessoria"));
const PublicZnSubscribe = lazy(() => import("./pages/PublicZnSubscribe"));

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
        <Route path="/" element={<Auth />} />
        <Route path="/bio" element={<LinkBio />} />
        <Route path="/plans" element={<PlansLanding />} />
        <Route path="/assessoria" element={<AssessoriaLanding />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/form/:formId" element={<PublicCheckinForm />} />
        <Route path="/anamnese-form/:formId" element={<PublicAnamneseForm />} />
        <Route path="/agendar/:slug" element={<PublicBooking />} />
        <Route path="/agendar-call/:slug" element={<PublicCallBooking />} />
        <Route path="/booking/:token" element={<PublicBookingConsult />} />
        <Route path="/metabolic-screening" element={<PublicMetabolicScreening />} />
        <Route path="/call/:slug" element={<PublicStrategicCall />} />
        <Route path="/unsubscribe" element={<Unsubscribe />} />
        <Route path="/np-checkin/:token" element={<PublicNpCheckin />} />
        <Route path="/termos" element={<Terms />} />
        <Route path="/onboarding" element={<PublicOnboarding />} />
        <Route path="/zn/assinar" element={<Navigate to={`/anamnese-form/cdb87aff-804f-4c5f-9b90-61923317531a?zn=1${typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('plano') ? `&plano=${new URLSearchParams(window.location.search).get('plano')}` : ''}${typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('cupom') ? `&cupom=${new URLSearchParams(window.location.search).get('cupom')}` : ''}`} replace />} />
        <Route path="/zn/anamnese" element={<Navigate to={`/anamnese-form/cdb87aff-804f-4c5f-9b90-61923317531a?zn=1${typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('plano') ? `&plano=${new URLSearchParams(window.location.search).get('plano')}` : ''}${typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('cupom') ? `&cupom=${new URLSearchParams(window.location.search).get('cupom')}` : ''}`} replace />} />
        <Route path="/athlete" element={<AthleteRoute allowAdmin><AthleteDashboard /></AthleteRoute>} />
        <Route path="/athlete/anamnese" element={<AthleteRoute allowAdmin><AthleteDynamicAnamneseForm /></AthleteRoute>} />
        <Route path="/admin" element={<ProtectedRoute adminOnly><Dashboard /></ProtectedRoute>} />
        <Route path="/tasks" element={<ProtectedRoute adminOnly><Tasks /></ProtectedRoute>} />
        <Route path="/adjustments" element={<ProtectedRoute adminOnly><Adjustments /></ProtectedRoute>} />
        <Route path="/clients" element={<ProtectedRoute adminOnly><Clients /></ProtectedRoute>} />
        <Route path="/meal-plans" element={<ProtectedRoute adminOnly><MealPlans /></ProtectedRoute>} />
        <Route path="/meal-plans/:clientId" element={<ProtectedRoute adminOnly><MealPlanDetail /></ProtectedRoute>} />
        <Route path="/periodization" element={<ProtectedRoute adminOnly><NutritionalPeriodization /></ProtectedRoute>} />
        <Route path="/metabolic-web" element={<ProtectedRoute adminOnly><MetabolicWeb /></ProtectedRoute>} />
        <Route path="/clients/:clientId" element={<ProtectedRoute adminOnly><ClientDetail /></ProtectedRoute>} />
        <Route path="/financial" element={<ProtectedRoute adminOnly><Financial /></ProtectedRoute>} />
        <Route path="/calendar" element={<ProtectedRoute adminOnly><CalendarPage /></ProtectedRoute>} />
        <Route path="/scheduling" element={<ProtectedRoute adminOnly><SchedulingSettings /></ProtectedRoute>} />
        <Route path="/scheduling/audit" element={<ProtectedRoute adminOnly><SchedulingAudit /></ProtectedRoute>} />
        <Route path="/scheduling/periodicity" element={<ProtectedRoute adminOnly><PeriodicityControl /></ProtectedRoute>} />
        <Route path="/content" element={<ProtectedRoute adminOnly><ContentManager /></ProtectedRoute>} />
        <Route path="/link-bio" element={<ProtectedRoute adminOnly><LinkBioManager /></ProtectedRoute>} />
        <Route path="/forms" element={<ProtectedRoute adminOnly><Forms /></ProtectedRoute>} />
        <Route path="/question-bank" element={<ProtectedRoute adminOnly><QuestionBank /></ProtectedRoute>} />
        <Route path="/checkin-hub" element={<ProtectedRoute adminOnly><CheckinHub /></ProtectedRoute>} />
        <Route path="/checkin" element={<ProtectedRoute adminOnly><Checkin /></ProtectedRoute>} />
        <Route path="/checkin/:formId" element={<ProtectedRoute adminOnly><CheckinFormBuilder /></ProtectedRoute>} />
        <Route path="/anamnese/:formId" element={<ProtectedRoute adminOnly><AnamneseFormBuilder /></ProtectedRoute>} />
        <Route path="/clients/:clientId/analysis" element={<ProtectedRoute adminOnly><AthleteAnalysis /></ProtectedRoute>} />
        <Route path="/clients/:clientId/history" element={<ProtectedRoute adminOnly><AthleteHistory /></ProtectedRoute>} />
        <Route path="/clients/:clientId/checkin-planning" element={<ProtectedRoute adminOnly><AthleteCheckinPlanning /></ProtectedRoute>} />
        <Route path="/checkin-review/:responseId" element={<ProtectedRoute adminOnly><CheckinReview /></ProtectedRoute>} />
        <Route path="/anamnese-response/:responseId" element={<ProtectedRoute adminOnly><AnamneseResponseDetail /></ProtectedRoute>} />
        <Route path="/appointments/:appointmentId" element={<ProtectedRoute adminOnly><AppointmentDetail /></ProtectedRoute>} />
        <Route path="/calls" element={<ProtectedRoute adminOnly><StrategicCalls /></ProtectedRoute>} />
        <Route path="/calls/:callId" element={<ProtectedRoute adminOnly><StrategicCallBuilder /></ProtectedRoute>} />
        <Route path="/calls/:callId/responses" element={<ProtectedRoute adminOnly><StrategicCallResponses /></ProtectedRoute>} />
        <Route path="/scheduling-links" element={<ProtectedRoute adminOnly><CallScheduling /></ProtectedRoute>} />
        <Route path="/scheduling-links/:linkId" element={<ProtectedRoute adminOnly><CallSchedulingConfig /></ProtectedRoute>} />
        <Route path="/ai-training" element={<ProtectedRoute adminOnly><AiTrainingCenter /></ProtectedRoute>} />
        <Route path="/zn-assessoria" element={<ProtectedRoute adminOnly><ZnAssessoria /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute adminOnly><Settings /></ProtectedRoute>} />
        <Route path="/nutriperiodiza/protocols" element={<ProtectedRoute adminOnly><NutriPeriodizaProtocols /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

const App = () => {
  const [theme, setTheme] = useState(() => localStorage.getItem('rf-theme') || 'dark');

  useEffect(() => {
    localStorage.setItem('rf-theme', theme);
  }, [theme]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeContext.Provider value={{ theme, setTheme }}>
          <div className={theme}>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AuthProvider>
                <AppRoutes />
              </AuthProvider>
            </BrowserRouter>
          </div>
        </ThemeContext.Provider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
