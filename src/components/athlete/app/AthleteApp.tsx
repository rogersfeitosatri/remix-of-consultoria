import { useMemo, useState } from 'react';
import { Eye, ArrowLeft } from 'lucide-react';
import { BottomNavigation, type AthleteScreen } from './BottomNavigation';
import { DashboardScreen } from './DashboardScreen';
import { MealPlanScreen } from './MealPlanScreen';
import { InstructionsScreen } from './InstructionsScreen';
import { RacePlanScreen } from './RacePlanScreen';
import { ProfileScreen } from './ProfileScreen';
import { CheckinsScreen } from './CheckinsScreen';
import { ConsultasScreen } from './ConsultasScreen';
import { NextActionsCard } from './NextActionsCard';
import { CheckinEvolutionCharts } from '@/components/checkin/CheckinEvolutionCharts';
import { normalizeMeals } from '@/lib/athletePlan';
import { useAthleteDailyLog } from '@/hooks/useAthleteDailyLog';
import { useActiveRace } from '@/hooks/useNutriPeriodiza';
import { useNutritionSupportWhatsapp } from '@/hooks/useNutritionSupportWhatsapp';
import { useAthleteAreaData, useAthleteActions, markSeen, type AthleteAction } from '@/hooks/useAthleteArea';
import type { AthleteAnalysis } from '@/hooks/useAthleteAnalysis';
import logoRF from '@/assets/logo-rf.jpg';

const SCREEN_TITLE: Record<AthleteScreen, string> = {
  dashboard: '',
  plano: 'Plano Alimentar',
  checkins: 'Check-ins',
  consultas: 'Consultas',
  orientacoes: 'Orientações',
  evolucao: 'Evolução',
  perfil: 'Perfil',
  provas: 'Plano de Prova',
};


export function AthleteApp({
  client,
  profile,
  analysis,
  checkins,
  checkinQuestions,
  email,
  weightKg,
  readOnly = false,
  isAdminViewing = false,
  anamnesePending = false,
  onFillAnamnese,
  onSignOut,
  onBackToAdmin,
}: {
  client: any;
  profile: any;
  analysis: AthleteAnalysis | null | undefined;
  checkins: any[];
  checkinQuestions: any[];
  email: string;
  weightKg?: number | null;
  readOnly?: boolean;
  isAdminViewing?: boolean;
  anamnesePending?: boolean;
  onFillAnamnese?: () => void;
  onSignOut: () => void;
  onBackToAdmin: () => void;
}) {
  const [screen, setScreen] = useState<AthleteScreen>('dashboard');
  const meals = useMemo(() => normalizeMeals(analysis), [analysis]);
  const { completedMeals, toggleMeal } = useAthleteDailyLog(client?.id, readOnly);
  const { data: race } = useActiveRace(client?.id);
  const { data: supportWhatsapp } = useNutritionSupportWhatsapp(client?.id);

  // ETAPA 5C — leitura canônica (dispatches, feedbacks publicados, consultas, plano publicado)
  const { data: areaData } = useAthleteAreaData(client?.id);
  const { actions, state } = useAthleteActions({
    client,
    clientId: client?.id,
    anamnesePending: anamnesePending && !readOnly,
    data: areaData,
  });
  const blockedReason = state.isOperational ? null : state.blockedReasons.join(' · ');

  const handleAction = (a: AthleteAction) => {
    if (a.kind === 'anamnese') { onFillAnamnese?.(); return; }
    if (a.kind === 'plano') { markSeen(client?.id, 'plano'); setScreen('plano'); return; }
    if (a.href) { window.open(a.href, '_blank', 'noopener'); return; }
    if (a.screen) setScreen(a.screen as AthleteScreen);
  };

  const firstName = (client?.name || 'Atleta').split(' ')[0];
  const profileEmail = client?.email || email;


  return (
    <div className="min-h-screen bg-[#0b0c0e] flex justify-center">
      <div className="w-full max-w-md min-h-screen bg-[#0b0c0e] text-white relative pb-24">
        {/* Admin viewing banner */}
        {isAdminViewing && (
          <div className="sticky top-0 z-40 bg-[hsl(43,74%,49%)] text-black py-2 px-4 flex items-center justify-center gap-2 text-sm font-medium">
            <Eye className="h-4 w-4" />
            Vendo como: {client?.name}
            <button onClick={onBackToAdmin} className="ml-2 inline-flex items-center gap-1 rounded-full bg-black/80 text-white px-2.5 py-0.5 text-xs">
              <ArrowLeft className="h-3 w-3" /> Admin
            </button>
          </div>
        )}

        {/* Top bar */}
        <header className="sticky z-30 bg-[#0b0c0e]/90 backdrop-blur-lg border-b border-gray-900" style={{ top: isAdminViewing ? 36 : 0 }}>
          <div className="flex items-center gap-2.5 px-4 h-14">
            <img src={logoRF} alt="RF" className="h-8 w-8 rounded-lg object-cover" />
            <span className="font-bold text-[hsl(43,74%,49%)] text-sm">
              {SCREEN_TITLE[screen] || 'Rogers Feitosa'}
            </span>
          </div>
        </header>

        <main className="px-4 pt-4">
          {blockedReason && (
            <div className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-sm font-semibold text-amber-200">Acompanhamento pausado</p>
              <p className="text-xs text-amber-100/80 mt-0.5">
                {blockedReason}. Seu histórico continua disponível, mas não há ações pendentes agora.
              </p>
            </div>
          )}

          {screen === 'dashboard' && (
            <div className="space-y-6">
              <NextActionsCard actions={actions} onAction={handleAction} />
              <DashboardScreen
                firstName={firstName}
                meals={meals}
                race={race}
                checkins={checkins}
                weightKg={weightKg}
                supportWhatsapp={supportWhatsapp}
                onOpenRace={() => setScreen('provas')}
                onGoPlano={() => setScreen('plano')}
                onGoEvolucao={() => setScreen('evolucao')}
                onGoOrientacoes={() => setScreen('orientacoes')}
              />
            </div>
          )}

          {screen === 'plano' && (
            <MealPlanScreen meals={meals} completedMeals={completedMeals} onToggleMeal={toggleMeal} readOnly={readOnly} />
          )}

          {screen === 'checkins' && (
            <CheckinsScreen data={areaData} clientId={client?.id} blockedReason={blockedReason} />
          )}

          {screen === 'consultas' && <ConsultasScreen data={areaData} blockedReason={blockedReason} />}

          {screen === 'orientacoes' && <InstructionsScreen analysis={analysis} />}

          {screen === 'provas' && <RacePlanScreen clientId={client.id} onBack={() => setScreen('dashboard')} />}


          {screen === 'evolucao' && (
            <div className="space-y-4">
              <h1 className="text-xl font-extrabold text-white">Sua evolução</h1>
              {checkins.length === 0 ? (
                <div className="rounded-3xl bg-[#131417] border border-gray-800 py-14 text-center">
                  <p className="text-4xl mb-3">📈</p>
                  <p className="text-gray-300 font-medium">Ainda sem check-ins.</p>
                  <p className="text-gray-500 text-sm mt-1">Seus gráficos aparecem aqui a cada check-in.</p>
                </div>
              ) : (
                <CheckinEvolutionCharts responses={checkins} questions={checkinQuestions} clientName={client?.name} clientId={client?.id} />
              )}
            </div>
          )}

          {screen === 'perfil' && (
            <ProfileScreen
              client={client}
              profile={profile}
              email={profileEmail}
              weightKg={weightKg}
              readOnly={readOnly}
              onSignOut={onSignOut}
            />
          )}
        </main>

        <BottomNavigation active={screen} onChange={setScreen} />
      </div>
    </div>
  );
}
