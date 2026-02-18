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
  const { method, loadingMethod } = usePeriodizationMethod();
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

  // Recover initial_cho_gkg from saved record (any type cast since new column)
  const savedInitialCho = (athletePeriodization as any)?.initial_cho_gkg ?? 4;

  // Init start date from saved periodization or client start date
  useEffect(() => {
    if (athletePeriodization?.start_date) {
      setStartDate(athletePeriodization.start_date);
    } else if (client?.start_date) {
      setStartDate(client.start_date);
    }
  }, [athletePeriodization?.start_date, client?.start_date]);

  // Persist startDate change to DB when periodization already exists
  const handleStartDateChange = async (date: string) => {
    setStartDate(date);
    if (athletePeriodization?.id) {
      await supabase
        .from('athlete_periodization')
        .update({ start_date: date, updated_at: new Date().toISOString() })
        .eq('id', athletePeriodization.id);
    }
  };

  // Ensure parent periodization record exists, persist cho_gkg too
  const handleSavePhases = async (phases: any[], initialChoGkg?: number) => {
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
      // save cho on newly created record
      if (periodizationId && initialChoGkg != null) {
        await supabase
          .from('athlete_periodization')
          .update({ initial_cho_gkg: initialChoGkg })
          .eq('id', periodizationId);
      }
    } else if (periodizationId) {
      // Update start_date, race_date and initial_cho_gkg on existing record
      await supabase
        .from('athlete_periodization')
        .update({
          start_date: startDate,
          race_date: raceDate,
          updated_at: new Date().toISOString(),
          ...(initialChoGkg != null ? { initial_cho_gkg: initialChoGkg } : {}),
        })
        .eq('id', periodizationId);
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
            onStartDateChange={handleStartDateChange}
            initialChoGkg={typeof savedInitialCho === 'number' ? savedInitialCho : parseFloat(savedInitialCho) || 4}
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
            onGenerateDynamics={(weekId, phase, onSuccess) => generateDynamics.mutate({ weekId, phase }, { onSuccess: (data) => { if (onSuccess && data) onSuccess(data); } })}
            isGeneratingDynamics={generateDynamics.isPending}
            onSaveDynamics={() => {}}
            isSavingDynamics={false}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
