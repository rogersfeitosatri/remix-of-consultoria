import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { addWeeks, format } from 'date-fns';

export interface DailyControlCycle {
  id: string;
  client_id: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
}

export interface DailyControlEntry {
  id: string;
  cycle_id: string;
  entry_date: string;
  weight: number | null;
  waist_circumference: number | null;
  created_at: string;
  updated_at: string;
}

// Athlete: Get active cycle
export function useActiveCycle(clientId?: string) {
  return useQuery({
    queryKey: ['daily-control-active-cycle', clientId],
    queryFn: async () => {
      if (!clientId) return null;
      const { data, error } = await supabase
        .from('daily_control_cycles')
        .select('*')
        .eq('client_id', clientId)
        .eq('is_active', true)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data as DailyControlCycle | null;
    },
    enabled: !!clientId,
    staleTime: 1000 * 60 * 3, // 3 minutes
  });
}

// Athlete: Get all cycles (for history)
export function useAllCycles(clientId?: string) {
  return useQuery({
    queryKey: ['daily-control-all-cycles', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('daily_control_cycles')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as DailyControlCycle[];
    },
    enabled: !!clientId,
    staleTime: 1000 * 60 * 3, // 3 minutes
  });
}

// Athlete: Start new cycle
export function useStartCycle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ clientId, startDate }: { clientId: string; startDate: Date }) => {
      // First, deactivate any existing active cycle
      await supabase
        .from('daily_control_cycles')
        .update({ is_active: false })
        .eq('client_id', clientId)
        .eq('is_active', true);
      
      // Create new cycle (6 weeks)
      const endDate = addWeeks(startDate, 6);
      const { data, error } = await supabase
        .from('daily_control_cycles')
        .insert({
          client_id: clientId,
          start_date: format(startDate, 'yyyy-MM-dd'),
          end_date: format(endDate, 'yyyy-MM-dd'),
          is_active: true,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['daily-control-active-cycle', variables.clientId] });
      queryClient.invalidateQueries({ queryKey: ['daily-control-all-cycles', variables.clientId] });
    },
  });
}

// Athlete: Reset cycle (archive current and create new)
export function useResetCycle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ clientId, startDate }: { clientId: string; startDate: Date }) => {
      // Deactivate current cycle
      await supabase
        .from('daily_control_cycles')
        .update({ is_active: false })
        .eq('client_id', clientId)
        .eq('is_active', true);
      
      // Create new cycle
      const endDate = addWeeks(startDate, 6);
      const { data, error } = await supabase
        .from('daily_control_cycles')
        .insert({
          client_id: clientId,
          start_date: format(startDate, 'yyyy-MM-dd'),
          end_date: format(endDate, 'yyyy-MM-dd'),
          is_active: true,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['daily-control-active-cycle', variables.clientId] });
      queryClient.invalidateQueries({ queryKey: ['daily-control-all-cycles', variables.clientId] });
      queryClient.invalidateQueries({ queryKey: ['daily-control-entries'] });
    },
  });
}

// Athlete: Get entries for a cycle
export function useCycleEntries(cycleId?: string) {
  return useQuery({
    queryKey: ['daily-control-entries', cycleId],
    queryFn: async () => {
      if (!cycleId) return [];
      const { data, error } = await supabase
        .from('daily_control_entries')
        .select('*')
        .eq('cycle_id', cycleId)
        .order('entry_date', { ascending: true });
      if (error) throw error;
      return data as DailyControlEntry[];
    },
    enabled: !!cycleId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

// Athlete: Add/Update entry
export function useUpsertEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ cycleId, entryDate, weight, waistCircumference }: { 
      cycleId: string; 
      entryDate: string;
      weight?: number;
      waistCircumference?: number;
    }) => {
      const { data, error } = await supabase
        .from('daily_control_entries')
        .upsert({
          cycle_id: cycleId,
          entry_date: entryDate,
          weight: weight ?? null,
          waist_circumference: waistCircumference ?? null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'cycle_id,entry_date' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['daily-control-entries', variables.cycleId] });
    },
  });
}
