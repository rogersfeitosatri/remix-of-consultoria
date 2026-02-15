import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { differenceInWeeks, addWeeks, format, isBefore, isAfter, parseISO, startOfDay } from 'date-fns';

interface TimelineBlock {
  block_index: number;
  start_date: string;
  end_date: string;
  phase_id: string;
  phase_name_snapshot: string;
  adjustment_checkpoint_date: string;
  status: 'past' | 'current' | 'future';
  phase_override?: boolean;
}

export function useAthletePeriodization(clientId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: athletePeriodization, isLoading } = useQuery({
    queryKey: ['athlete-periodization', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('athlete_periodization')
        .select('*')
        .eq('client_id', clientId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  // Notes
  const { data: notes = [] } = useQuery({
    queryKey: ['athlete-periodization-notes', athletePeriodization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('athlete_periodization_notes')
        .select('*')
        .eq('athlete_periodization_id', athletePeriodization!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!athletePeriodization?.id,
  });

  // Generate timeline blocks
  const generateTimeline = (
    startDate: string,
    raceDate: string,
    planType: 'monthly' | '6_weeks',
    activePhases: any[]
  ): TimelineBlock[] => {
    const start = parseISO(startDate);
    const race = parseISO(raceDate);
    const totalWeeks = Math.max(differenceInWeeks(race, start), 1);
    const blockSize = planType === '6_weeks' ? 6 : 4;
    const numBlocks = Math.ceil(totalWeeks / blockSize);
    const today = startOfDay(new Date());

    if (activePhases.length === 0) return [];

    // Distribute phases: 40% first, 40% second, 20% third, last 2 weeks = taper if exists
    const blocks: TimelineBlock[] = [];
    const taperPhase = activePhases.find((p: any) => p.phase_name.toLowerCase().includes('transição') || p.phase_name.toLowerCase().includes('taper'));
    const mainPhases = activePhases.filter((p: any) => p !== taperPhase);

    for (let i = 0; i < numBlocks; i++) {
      const blockStart = addWeeks(start, i * blockSize);
      const blockEnd = i === numBlocks - 1 ? race : addWeeks(start, (i + 1) * blockSize);

      // Determine phase
      const progress = i / numBlocks;
      let phase;
      if (totalWeeks <= 10) {
        // Short cycle: skip base, go construction -> peak -> taper
        if (progress < 0.5) phase = mainPhases[Math.min(1, mainPhases.length - 1)];
        else if (progress < 0.85) phase = mainPhases[Math.min(2, mainPhases.length - 1)] || mainPhases[mainPhases.length - 1];
        else phase = taperPhase || mainPhases[mainPhases.length - 1];
      } else {
        if (progress < 0.4) phase = mainPhases[0];
        else if (progress < 0.8) phase = mainPhases[Math.min(1, mainPhases.length - 1)];
        else if (progress < 0.9) phase = mainPhases[Math.min(2, mainPhases.length - 1)] || mainPhases[mainPhases.length - 1];
        else phase = taperPhase || mainPhases[mainPhases.length - 1];
      }

      const checkpointDate = format(blockEnd, 'yyyy-MM-dd');
      const blockStartDate = format(blockStart, 'yyyy-MM-dd');
      const blockEndDate = format(blockEnd, 'yyyy-MM-dd');

      let status: 'past' | 'current' | 'future' = 'future';
      if (isAfter(today, parseISO(blockEndDate))) status = 'past';
      else if (!isBefore(today, parseISO(blockStartDate)) && !isAfter(today, parseISO(blockEndDate))) status = 'current';

      blocks.push({
        block_index: i,
        start_date: blockStartDate,
        end_date: blockEndDate,
        phase_id: phase?.id || '',
        phase_name_snapshot: phase?.phase_name || 'Sem fase',
        adjustment_checkpoint_date: checkpointDate,
        status,
      });
    }

    return blocks;
  };

  // Create or update athlete periodization
  const savePeriodization = useMutation({
    mutationFn: async (data: {
      start_date: string;
      race_date: string;
      plan_adjustment_type: 'monthly' | '6_weeks';
      method_id: string;
      timeline_blocks: TimelineBlock[];
    }) => {
      const payload = {
        start_date: data.start_date,
        race_date: data.race_date,
        plan_adjustment_type: data.plan_adjustment_type,
        method_id: data.method_id,
        timeline_blocks: data.timeline_blocks as any,
        updated_at: new Date().toISOString(),
      };
      if (athletePeriodization?.id) {
        const { error } = await supabase
          .from('athlete_periodization')
          .update(payload)
          .eq('id', athletePeriodization.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('athlete_periodization')
          .insert({
            ...payload,
            user_id: user!.id,
            client_id: clientId!,
          } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['athlete-periodization', clientId] });
      toast({ title: 'Periodização salva' });
    },
    onError: (err: any) => {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    },
  });

  // Update single block (phase override)
  const updateBlock = useMutation({
    mutationFn: async ({ blockIndex, phaseId, phaseName }: { blockIndex: number; phaseId: string; phaseName: string }) => {
      if (!athletePeriodization?.id) return;
      const blocks = [...((athletePeriodization.timeline_blocks as any[]) || [])];
      blocks[blockIndex] = {
        ...blocks[blockIndex],
        phase_id: phaseId,
        phase_name_snapshot: phaseName,
        phase_override: true,
      };
      const { error } = await supabase
        .from('athlete_periodization')
        .update({ timeline_blocks: blocks, updated_at: new Date().toISOString() })
        .eq('id', athletePeriodization.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['athlete-periodization', clientId] });
      toast({ title: 'Fase do bloco atualizada' });
    },
  });

  // Add note
  const addNote = useMutation({
    mutationFn: async ({ phaseId, blockIndex, noteText }: { phaseId: string; blockIndex?: number; noteText: string }) => {
      const { error } = await supabase
        .from('athlete_periodization_notes')
        .insert({
          athlete_periodization_id: athletePeriodization!.id,
          phase_id: phaseId,
          block_index: blockIndex ?? null,
          note_text: noteText,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['athlete-periodization-notes'] });
      toast({ title: 'Nota adicionada' });
    },
  });

  // Delete note
  const deleteNote = useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase
        .from('athlete_periodization_notes')
        .delete()
        .eq('id', noteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['athlete-periodization-notes'] });
    },
  });

  return {
    athletePeriodization,
    isLoading,
    notes,
    generateTimeline,
    savePeriodization,
    updateBlock,
    addNote,
    deleteNote,
  };
}
