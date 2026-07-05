import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole, useAthleteClient, useCheckinResponses, useCheckinQuestions, useAthleteProfile } from '@/hooks/useUserRole';
import { useAthleteAnalysis } from '@/hooks/useAthleteAnalysis';
import { useAthleteWeight } from '@/hooks/useAthleteWeight';
import { AthleteApp } from '@/components/athlete/app/AthleteApp';
import { Button } from '@/components/ui/button';
import { Home, Eye } from 'lucide-react';

export default function AthleteDashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, signOut, loading: authLoading } = useAuth();
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const { data: ownClient, isLoading: clientLoading } = useAthleteClient();

  // Admin "Visualizar como atleta": /athlete?clientId=<id> renders THAT athlete's app.
  const viewClientId = isAdmin ? searchParams.get('clientId') : null;
  const { data: adminViewClient, isLoading: adminViewLoading } = useQuery({
    queryKey: ['admin-view-client', viewClientId],
    enabled: !!viewClientId,
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('*').eq('id', viewClientId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const isAdminViewing = !!viewClientId && !!adminViewClient;
  const client: any = isAdminViewing ? adminViewClient : ownClient;

  const { data: athleteProfile } = useAthleteProfile(client?.id);
  const { data: analysis } = useAthleteAnalysis(client?.id);
  const { data: checkinResponses = [] } = useCheckinResponses(client?.id);
  const firstFormId = checkinResponses[0]?.form_id;
  const { data: checkinQuestions = [] } = useCheckinQuestions(firstFormId);

  const athleteWeightKg =
    (athleteProfile as any)?.current_weight ??
    (client as any)?.current_weight ??
    (() => {
      const found: any = checkinResponses.find((c: any) => c?.responses?.peso);
      const p = found?.responses?.peso;
      return p ? parseFloat(String(p).replace(',', '.')) : null;
    })();

  const anamneseCompleted =
    (athleteProfile as any)?.anamnese_completed === true || (athleteProfile as any)?.anamnese_submitted_at != null;

  const handleSignOut = async () => {
    try { await signOut(); } catch (e) { console.error(e); }
    finally { localStorage.clear(); sessionStorage.clear(); navigate('/auth', { replace: true }); }
  };
  const handleBackToAdmin = () => navigate('/admin');
  const handleFillAnamnese = () => navigate('/athlete/anamnese');

  if (authLoading || clientLoading || roleLoading || (viewClientId && adminViewLoading)) {
    return (
      <div className="min-h-screen bg-[#0b0c0e] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[hsl(43,74%,49%)]" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  // Admin without a selected athlete → prompt to pick one.
  if (isAdmin && !client && !viewClientId) {
    return (
      <div className="min-h-screen bg-[#0b0c0e] flex flex-col items-center justify-center p-6 text-center">
        <Eye className="h-14 w-14 text-[hsl(43,74%,49%)] mb-4" />
        <h1 className="text-xl font-bold text-white mb-2">Visualizar área do atleta</h1>
        <p className="text-gray-400 mb-6 max-w-sm">
          Selecione um atleta em <span className="text-white font-medium">"Visualizar como atleta"</span> na barra lateral do admin para ver o app dele.
        </p>
        <Button onClick={handleBackToAdmin} variant="outline" className="border-gray-700 text-white hover:bg-gray-800">
          Voltar ao admin
        </Button>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-[#0b0c0e] flex flex-col items-center justify-center p-4">
        <Home className="h-16 w-16 text-gray-500 mb-4" />
        <h1 className="text-2xl font-bold text-white mb-2">Conta não vinculada</h1>
        <p className="text-gray-400 text-center mb-6">Seu e-mail não está vinculado a nenhum atleta. Entre em contato com seu assessor.</p>
        <Button onClick={handleSignOut} variant="outline" className="border-gray-700 text-white hover:bg-gray-800">Sair</Button>
      </div>
    );
  }

  return (
    <AthleteApp
      client={client}
      profile={athleteProfile}
      analysis={analysis}
      checkins={checkinResponses}
      checkinQuestions={checkinQuestions}
      email={user.email || ''}
      weightKg={athleteWeightKg}
      readOnly={isAdminViewing}
      isAdminViewing={isAdminViewing}
      anamnesePending={!anamneseCompleted}
      onFillAnamnese={handleFillAnamnese}
      onSignOut={handleSignOut}
      onBackToAdmin={handleBackToAdmin}
    />
  );
}
