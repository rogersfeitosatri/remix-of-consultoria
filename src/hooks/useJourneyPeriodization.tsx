import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { addWeeks, differenceInWeeks, format, parseISO } from 'date-fns';

const DEFAULT_PHASES = [
  { phase_name: 'Base', phase_order: 0, objective: 'Adaptação metabólica, eficiência lipídica e construção de base aeróbia.', cho_range: '3-5 g/kg', train_low_strategy: 'permitido', recovery_strategy: 'Regenerativo moderado', body_comp_strategy: 'Manutenção ou leve redução de gordura', supplement_base: 'Creatina 5g, Ômega-3 2g, Vitamina D', creatine: '5g/dia', beta_alanine: '3.2g/dia (loading)', caffeine: '—', nitrate: '—', supplement_general: 'Foco em adaptação metabólica. Suplementação de base.' },
  { phase_name: 'Específica', phase_order: 1, objective: 'Desenvolvimento de capacidade específica, treino intestinal e aumento progressivo de CHO intra.', cho_range: '4-6 g/kg', train_low_strategy: 'reduzido', recovery_strategy: 'Recovery 4:1 pós treino-chave', body_comp_strategy: 'Estabilizar composição corporal', supplement_base: 'Creatina 5g, Cafeína 3mg/kg, Ômega-3', creatine: '5g/dia', beta_alanine: '3.2g/dia', caffeine: '3 mg/kg pré treino-chave', nitrate: 'Iniciar testes', supplement_general: 'Início da estratégia de prova. Treino intestinal com gel.' },
  { phase_name: 'Competitiva', phase_order: 2, objective: 'Simulação de prova, carb-loading, maximizar rendimento.', cho_range: '5-8 g/kg', train_low_strategy: 'proibido', recovery_strategy: 'Recovery imediato pós longão, glutamina', body_comp_strategy: 'Manutenção estrita', supplement_base: 'Cafeína, Nitrato, Creatina, Gel intra 60-90g/h', creatine: '5g/dia', beta_alanine: '3.2g/dia', caffeine: '3-6 mg/kg', nitrate: '400-800mg 2-3h pré', supplement_general: 'Estratégia completa de prova. Simular protocolo intra.' },
  { phase_name: 'Pico', phase_order: 3, objective: 'Polimento final, taper nutricional, carb-loading pré-prova.', cho_range: '8-12 g/kg', train_low_strategy: 'proibido', recovery_strategy: 'Regenerativo leve', body_comp_strategy: 'Aceitar leve aumento de peso (glicogênio)', supplement_base: 'Carb-loading +6g/kg 48h, Gel protocolo definido', creatine: '5g/dia', beta_alanine: 'Manutenção', caffeine: '3-6 mg/kg (dia da prova)', nitrate: '400-800mg', supplement_general: 'Foco total na prova. Nenhuma experimentação.' },
  { phase_name: 'Transição', phase_order: 4, objective: 'Recuperação pós-prova, restauração do metabolismo e planejamento do próximo ciclo.', cho_range: '3-5 g/kg', train_low_strategy: 'permitido', recovery_strategy: 'Completa, foco em anti-inflamatórios', body_comp_strategy: 'Flexível', supplement_base: 'Ômega-3, Vitamina D, Glutamina', creatine: 'Manutenção', beta_alanine: '—', caffeine: 'Reduzir/ciclar', nitrate: '—', supplement_general: 'Fase de recuperação e recomposição.' },
];

const PHASE_WEIGHT = [0.30, 0.25, 0.25, 0.10, 0.10]; // Base, Específica, Competitiva, Pico, Transição

export function useJourneyPeriodization(clientId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch athlete_periodization (parent record)
  const { data: athletePeriodization } = useQuery({
    queryKey: ['athlete-periodization', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('athlete_periodization')
        .select('*')
        .eq('client_id', clientId!)
        .maybeSingle();
      return data;
    },
    enabled: !!clientId,
  });

  // Fetch journey phases for this athlete
  const { data: journeyPhases = [], isLoading: loadingPhases } = useQuery({
    queryKey: ['journey-phases', clientId],
    queryFn: async () => {
      if (!athletePeriodization?.id) return [];
      const { data, error } = await supabase
        .from('journey_phases')
        .select('*')
        .eq('athlete_periodization_id', athletePeriodization.id)
        .order('phase_order');
      if (error) throw error;
      return data || [];
    },
    enabled: !!athletePeriodization?.id,
  });

  // Fetch journey weeks
  const { data: journeyWeeks = [] } = useQuery({
    queryKey: ['journey-weeks', clientId],
    queryFn: async () => {
      const phaseIds = journeyPhases.map(p => p.id);
      if (phaseIds.length === 0) return [];
      const { data, error } = await supabase
        .from('journey_weeks')
        .select('*')
        .in('journey_phase_id', phaseIds)
        .order('week_number');
      if (error) throw error;
      return data || [];
    },
    enabled: journeyPhases.length > 0,
  });

  // Fetch client info for plan expiration
  const { data: clientInfo } = useQuery({
    queryKey: ['journey-client-info', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('clients')
        .select('end_date, name, plan_type, start_date')
        .eq('id', clientId!)
        .single();
      return data;
    },
    enabled: !!clientId,
  });

  // Generate suggested phase distribution
  const suggestPhases = (totalWeeks: number, startDate: string): typeof DEFAULT_PHASES & { duration_weeks: number; start_date: string; end_date: string }[] => {
    const phases = DEFAULT_PHASES.map((p, i) => {
      const weeks = Math.max(Math.round(totalWeeks * PHASE_WEIGHT[i]), 1);
      return { ...p, duration_weeks: weeks };
    });

    // Adjust to match total
    const sum = phases.reduce((a, p) => a + p.duration_weeks, 0);
    const diff = totalWeeks - sum;
    if (diff !== 0) {
      // Add/remove from Base (largest phase)
      phases[0].duration_weeks = Math.max(phases[0].duration_weeks + diff, 1);
    }

    // Calculate dates
    let currentDate = parseISO(startDate);
    return phases.map((p) => {
      const start = format(currentDate, 'yyyy-MM-dd');
      currentDate = addWeeks(currentDate, p.duration_weeks);
      const end = format(currentDate, 'yyyy-MM-dd');
      return { ...p, start_date: start, end_date: end };
    });
  };

  // Save journey phases (create all at once)
  const saveJourneyPhases = useMutation({
    mutationFn: async ({ periodizationId, phases }: { periodizationId: string; phases: any[] }) => {
      // Delete existing phases first
      await supabase.from('journey_phases').delete().eq('athlete_periodization_id', periodizationId);

      // Insert new phases
      const rows = phases.map((p, i) => ({
        athlete_periodization_id: periodizationId,
        client_id: clientId!,
        user_id: user!.id,
        phase_name: p.phase_name,
        phase_order: i,
        duration_weeks: p.duration_weeks,
        start_date: p.start_date,
        end_date: p.end_date,
        status: 'pending' as string,
        objective: p.objective || null,
        cho_range: p.cho_range || null,
        train_low_strategy: p.train_low_strategy || null,
        recovery_strategy: p.recovery_strategy || null,
        body_comp_strategy: p.body_comp_strategy || null,
        supplement_base: p.supplement_base || null,
        strategic_notes: p.strategic_notes || null,
        creatine: p.creatine || null,
        beta_alanine: p.beta_alanine || null,
        caffeine: p.caffeine || null,
        nitrate: p.nitrate || null,
        supplement_general: p.supplement_general || null,
      }));

      const { error } = await supabase.from('journey_phases').insert(rows);
      if (error) throw error;

      // Also generate weeks for each phase
      const { data: insertedPhases } = await supabase
        .from('journey_phases')
        .select('id, phase_order, duration_weeks')
        .eq('athlete_periodization_id', periodizationId)
        .order('phase_order');

      if (insertedPhases) {
        let weekNum = 1;
        const weekRows: any[] = [];
        for (const phase of insertedPhases) {
          for (let w = 1; w <= phase.duration_weeks; w++) {
            weekRows.push({
              journey_phase_id: phase.id,
              client_id: clientId!,
              user_id: user!.id,
              week_number: weekNum,
              week_in_phase: w,
              status: 'pending',
            });
            weekNum++;
          }
        }
        if (weekRows.length > 0) {
          await supabase.from('journey_weeks').insert(weekRows);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journey-phases', clientId] });
      queryClient.invalidateQueries({ queryKey: ['journey-weeks', clientId] });
      toast({ title: 'Jornada configurada com sucesso' });
    },
    onError: (err: any) => {
      toast({ title: 'Erro ao salvar jornada', description: err.message, variant: 'destructive' });
    },
  });

  // Update a single phase's structural data
  const updatePhase = useMutation({
    mutationFn: async ({ phaseId, data }: { phaseId: string; data: any }) => {
      const { error } = await supabase
        .from('journey_phases')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', phaseId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journey-phases', clientId] });
      toast({ title: 'Fase atualizada' });
    },
  });

  return {
    athletePeriodization,
    journeyPhases,
    journeyWeeks,
    clientInfo,
    loadingPhases,
    suggestPhases,
    saveJourneyPhases,
    updatePhase,
    DEFAULT_PHASES,
  };
}
