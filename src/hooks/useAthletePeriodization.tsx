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

  // Generate timeline blocks — ensures ALL phases are always present
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
    const numBlocks = Math.max(Math.ceil(totalWeeks / blockSize), 1);
    const today = startOfDay(new Date());

    if (activePhases.length === 0) return [];

    // Separate taper/transition phase (goes last) from main phases
    const taperPhase = activePhases.find((p: any) =>
      p.phase_name.toLowerCase().includes('transição') || p.phase_name.toLowerCase().includes('taper')
    );
    const mainPhases = activePhases.filter((p: any) => p !== taperPhase);
    
    // Build ordered phase list: all main phases + taper at end (if exists)
    const orderedPhases = [...mainPhases];
    if (taperPhase) orderedPhases.push(taperPhase);
    
    // Distribute blocks ensuring EVERY phase gets at least 1 block
    // Default weight distribution: 40/40/20 for 3 main phases, taper gets minimum
    const phaseCount = orderedPhases.length;
    
    // If fewer blocks than phases, we need at least as many blocks as phases
    const effectiveBlocks = Math.max(numBlocks, phaseCount);
    
    // Calculate how many blocks each phase gets
    const phaseBlockCounts: number[] = new Array(phaseCount).fill(1); // minimum 1 each
    let remaining = effectiveBlocks - phaseCount;
    
    if (remaining > 0 && phaseCount > 0) {
      // Distribute remaining using weights: 40/40/20 for main, taper gets 0 extra
      const weights: number[] = [];
      for (let i = 0; i < phaseCount; i++) {
        if (orderedPhases[i] === taperPhase) {
          weights.push(0); // Taper keeps minimum blocks
        } else if (mainPhases.length === 1) {
          weights.push(1);
        } else if (mainPhases.length === 2) {
          weights.push(i === 0 ? 0.5 : 0.5);
        } else {
          // 3+ main phases: 40/40/20 pattern
          if (i === 0) weights.push(0.4);
          else if (i === 1) weights.push(0.4);
          else weights.push(0.2 / (mainPhases.length - 2));
        }
      }
      
      const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;
      const normalizedWeights = weights.map(w => w / totalWeight);
      
      // Distribute remaining blocks by weight
      let distributed = 0;
      for (let i = 0; i < phaseCount; i++) {
        const extra = Math.round(normalizedWeights[i] * remaining);
        phaseBlockCounts[i] += extra;
        distributed += extra;
      }
      // Fix rounding errors
      const diff = remaining - distributed;
      if (diff !== 0) {
        // Add/remove from largest main phase
        phaseBlockCounts[0] += diff;
        if (phaseBlockCounts[0] < 1) phaseBlockCounts[0] = 1;
      }
    }

    // Build blocks
    const blocks: TimelineBlock[] = [];
    let blockIdx = 0;
    
    for (let pIdx = 0; pIdx < phaseCount; pIdx++) {
      const phase = orderedPhases[pIdx];
      const count = phaseBlockCounts[pIdx];
      
      for (let j = 0; j < count; j++) {
        const blockStart = addWeeks(start, blockIdx * blockSize);
        const isLast = blockIdx === effectiveBlocks - 1;
        const blockEnd = isLast ? race : addWeeks(start, (blockIdx + 1) * blockSize);

        const blockStartDate = format(blockStart, 'yyyy-MM-dd');
        const blockEndDate = format(blockEnd, 'yyyy-MM-dd');
        const checkpointDate = format(blockEnd, 'yyyy-MM-dd');

        let status: 'past' | 'current' | 'future' = 'future';
        if (isAfter(today, parseISO(blockEndDate))) status = 'past';
        else if (!isBefore(today, parseISO(blockStartDate)) && !isAfter(today, parseISO(blockEndDate))) status = 'current';

        blocks.push({
          block_index: blockIdx,
          start_date: blockStartDate,
          end_date: blockEndDate,
          phase_id: phase?.id || '',
          phase_name_snapshot: phase?.phase_name || 'Sem fase',
          adjustment_checkpoint_date: checkpointDate,
          status,
        });
        blockIdx++;
      }
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
