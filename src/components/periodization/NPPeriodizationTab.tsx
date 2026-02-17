import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings2, Map } from 'lucide-react';
import { usePeriodizationMethod } from '@/hooks/usePeriodizationMethod';
import { useAthletePeriodization } from '@/hooks/useAthletePeriodization';
import { useJourneyPeriodization } from '@/hooks/useJourneyPeriodization';
import { MethodEditor } from './MethodEditor';
import { PeriodizationWizard } from './PeriodizationWizard';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  clientId: string;
  client?: any;
  consultationId?: string;
  consultation?: any;
}

export function NPPeriodizationTab({ clientId, client, consultationId, consultation }: Props) {
  const { method, loadingMethod, createMethod } = usePeriodizationMethod();
  const { athletePeriodization, savePeriodization } = useAthletePeriodization(clientId);
  const {
    journeyPhases, journeyWeeks, loadingPhases,
    allSessions, allDynamics,
    suggestPhases, recalcPhaseDates, saveJourneyPhases,
    saveSessions, generateDynamics,
  } = useJourneyPeriodization(clientId);

  const [activeView, setActiveView] = useState<'journey' | 'method'>('journey');
  const [startDate, setStartDate] = useState('');

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

  // If no method yet, prompt creation
  if (!loadingMethod && !method) {
    return <MethodEditor />;
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

        <TabsContent value="journey" className="mt-4">
          <PeriodizationWizard
            clientId={clientId}
            raceDate={raceDate}
            raceName={raceName}
            startDate={startDate}
            onStartDateChange={setStartDate}
            journeyPhases={journeyPhases}
            journeyWeeks={journeyWeeks}
            allSessions={allSessions}
            allDynamics={allDynamics}
            suggestPhases={suggestPhases}
            recalcPhaseDates={recalcPhaseDates}
            onSavePhases={handleSavePhases}
            isSavingPhases={saveJourneyPhases.isPending}
            onSaveSessions={(weekId, sessions) => saveSessions.mutate({ weekId, sessions })}
            isSavingSessions={saveSessions.isPending}
            onGenerateDynamics={(weekId, phase) => generateDynamics.mutate({ weekId, phase })}
            isGeneratingDynamics={generateDynamics.isPending}
            onSaveDynamics={() => {}}
            isSavingDynamics={false}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
