import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Settings2, Map } from 'lucide-react';
import { usePeriodizationMethod } from '@/hooks/usePeriodizationMethod';
import { useAthletePeriodization } from '@/hooks/useAthletePeriodization';
import { useJourneyPeriodization } from '@/hooks/useJourneyPeriodization';
import { MethodEditor } from './MethodEditor';
import { JourneyOverviewPanel } from './JourneyOverviewPanel';
import { JourneyPhaseConfig } from './JourneyPhaseConfig';
import { JourneyStructuralTable } from './JourneyStructuralTable';
import { JourneyTimeline } from './JourneyTimeline';
import { JourneyWeekSessions } from './JourneyWeekSessions';
import { JourneyDayDynamics } from './JourneyDayDynamics';
import { JourneyStrategicPanel } from './JourneyStrategicPanel';
import { JourneyPhaseTransition } from './JourneyPhaseTransition';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { differenceInWeeks, parseISO } from 'date-fns';

interface Props {
  clientId: string;
  client?: any;
  consultationId?: string;
  consultation?: any;
}

export function NPPeriodizationTab({ clientId, client, consultationId, consultation }: Props) {
  const { method, activePhases, loadingMethod, createMethod } = usePeriodizationMethod();
  const { athletePeriodization, savePeriodization } = useAthletePeriodization(clientId);
  const {
    journeyPhases, journeyWeeks, clientInfo, loadingPhases,
    allSessions, allDynamics, transitions,
    suggestPhases, saveJourneyPhases, updatePhase,
    saveSessions, saveDynamics, generateDynamics, transitionPhase,
  } = useJourneyPeriodization(clientId);

  const [activeView, setActiveView] = useState<'journey' | 'method'>('journey');
  const [startDate, setStartDate] = useState('');
  const [selectedWeekId, setSelectedWeekId] = useState<string>();

  // Fetch athlete profile for race info
  const { data: athleteProfile } = useQuery({
    queryKey: ['athlete-profile-periodization', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('athlete_profiles')
        .select('target_race, target_deadline, specific_target')
        .eq('client_id', clientId)
        .maybeSingle();
      return data;
    },
    enabled: !!clientId,
  });

  const raceDate = athleteProfile?.target_deadline || consultation?.target_race_date || '';
  const raceName = athleteProfile?.target_race || '';
  const raceMeta = athleteProfile?.specific_target || '';

  const totalWeeks = raceDate && startDate
    ? Math.max(differenceInWeeks(parseISO(raceDate), parseISO(startDate)), 1)
    : 0;

  // Init start date
  useEffect(() => {
    if (athletePeriodization?.start_date) {
      setStartDate(athletePeriodization.start_date);
    } else if (client?.start_date) {
      setStartDate(client.start_date);
    }
  }, [athletePeriodization, client]);

  // Ensure parent periodization record exists
  const handleSavePhases = async (phases: any[]) => {
    let periodizationId = athletePeriodization?.id;
    if (!periodizationId && method) {
      await savePeriodization.mutateAsync({
        start_date: startDate,
        race_date: raceDate,
        plan_adjustment_type: 'monthly',
        method_id: method.id,
        timeline_blocks: [],
      });
      const { data } = await supabase
        .from('athlete_periodization')
        .select('id')
        .eq('client_id', clientId)
        .single();
      periodizationId = data?.id;
    }
    if (periodizationId) {
      saveJourneyPhases.mutate({ periodizationId, phases });
    }
  };

  // Selected week data
  const selectedWeek = journeyWeeks.find(w => w.id === selectedWeekId);
  const selectedPhase = selectedWeek
    ? journeyPhases.find(p => p.id === selectedWeek.journey_phase_id)
    : null;
  const weekSessions = selectedWeekId
    ? allSessions.filter(s => s.journey_week_id === selectedWeekId)
    : [];
  const weekDynamics = selectedWeekId
    ? allDynamics.filter(d => d.journey_week_id === selectedWeekId)
    : [];

  // Current phase dynamics for strategic panel
  const currentPhase = journeyPhases.find(p => {
    if (!p.start_date || !p.end_date) return false;
    const today = new Date();
    return today >= parseISO(p.start_date) && today <= parseISO(p.end_date);
  });
  const currentPhaseWeekIds = currentPhase
    ? journeyWeeks.filter(w => w.journey_phase_id === currentPhase.id).map(w => w.id)
    : [];
  const phaseDynamics = allDynamics.filter(d => currentPhaseWeekIds.includes(d.journey_week_id));
  const phaseSessions = allSessions.filter(s => currentPhaseWeekIds.includes(s.journey_week_id));

  // If no method yet, prompt creation
  if (!loadingMethod && !method) {
    return (
      <div className="space-y-4">
        <MethodEditor />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={activeView} onValueChange={(v: any) => setActiveView(v)}>
        <TabsList className="h-8">
          <TabsTrigger value="journey" className="text-xs gap-1"><Map className="h-3 w-3" /> Jornada do Atleta</TabsTrigger>
          <TabsTrigger value="method" className="text-xs gap-1"><Settings2 className="h-3 w-3" /> Manual do Método</TabsTrigger>
        </TabsList>

        <TabsContent value="method" className="mt-4">
          <MethodEditor />
        </TabsContent>

        <TabsContent value="journey" className="mt-4 space-y-4">
          {/* 1. Visão Geral */}
          <JourneyOverviewPanel
            raceName={raceName}
            raceDate={raceDate}
            raceMeta={raceMeta}
            phases={journeyPhases}
            totalWeeks={totalWeeks}
            clientEndDate={clientInfo?.end_date}
          />

          {/* 2. Configuração */}
          <JourneyPhaseConfig
            raceDate={raceDate}
            startDate={startDate}
            onStartDateChange={setStartDate}
            suggestPhases={suggestPhases}
            onSavePhases={handleSavePhases}
            existingPhases={journeyPhases}
            isSaving={saveJourneyPhases.isPending}
            athletePeriodizationId={athletePeriodization?.id}
            raceName={raceName}
          />

          {/* 3. Tabela Estrutural */}
          <JourneyStructuralTable
            phases={journeyPhases}
            onUpdatePhase={(phaseId, data) => updatePhase.mutate({ phaseId, data })}
            isSaving={updatePhase.isPending}
          />

          {/* 6. Painel Estratégico da Fase Atual */}
          {currentPhase && phaseDynamics.length > 0 && (
            <JourneyStrategicPanel
              phaseName={currentPhase.phase_name}
              dynamics={phaseDynamics}
              sessions={phaseSessions}
            />
          )}

          {/* 7. Controle de Transição de Fase */}
          {currentPhase && journeyPhases.length > 1 && (
            <JourneyPhaseTransition
              phases={journeyPhases}
              currentPhaseId={currentPhase.id}
              transitions={transitions}
              onTransition={(fromId, toId, notes) => transitionPhase.mutate({ fromPhaseId: fromId, toPhaseId: toId, notes })}
              isTransitioning={transitionPhase.isPending}
            />
          )}

          <JourneyTimeline
            phases={journeyPhases}
            weeks={journeyWeeks}
            onSelectWeek={setSelectedWeekId}
            selectedWeekId={selectedWeekId}
          />

          {/* 4. Estruturação Semanal (when week selected) */}
          {selectedWeek && selectedPhase && (
            <>
              <JourneyWeekSessions
                weekId={selectedWeek.id}
                weekNumber={selectedWeek.week_number}
                weekInPhase={selectedWeek.week_in_phase}
                phaseName={selectedPhase.phase_name}
                existingSessions={weekSessions}
                onSaveSessions={(weekId, sessions) => saveSessions.mutate({ weekId, sessions })}
                isSaving={saveSessions.isPending}
              />

              {/* 5. Dinâmica Nutricional */}
              <JourneyDayDynamics
                weekId={selectedWeek.id}
                weekNumber={selectedWeek.week_number}
                phaseName={selectedPhase.phase_name}
                existingDynamics={weekDynamics}
                sessions={weekSessions}
                onGenerateDynamics={(weekId) => generateDynamics.mutate({ weekId, phase: selectedPhase })}
                onSaveDynamics={(weekId, dynamics) => saveDynamics.mutate({ weekId, dynamics })}
                isGenerating={generateDynamics.isPending}
                isSaving={saveDynamics.isPending}
              />
            </>
          )}

          {/* Empty state */}
          {journeyPhases.length === 0 && !raceDate && (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <h3 className="text-sm font-semibold">Configure a prova alvo</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Defina a prova alvo no perfil do atleta para iniciar a jornada de periodização.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
