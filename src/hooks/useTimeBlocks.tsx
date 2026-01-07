import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface TimeBlock {
  id: string;
  settings_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  created_at: string;
}

export function useTimeBlocks(settingsId?: string) {
  return useQuery({
    queryKey: ['time_blocks', settingsId],
    queryFn: async () => {
      if (!settingsId) return [];
      
      const { data, error } = await supabase
        .from('scheduling_time_blocks')
        .select('*')
        .eq('settings_id', settingsId)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;
      return data as TimeBlock[];
    },
    enabled: !!settingsId,
  });
}

export function useAddTimeBlock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (block: Omit<TimeBlock, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('scheduling_time_blocks')
        .insert(block)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['time_blocks', variables.settings_id] });
    },
  });
}

export function useDeleteTimeBlock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, settingsId }: { id: string; settingsId: string }) => {
      const { error } = await supabase
        .from('scheduling_time_blocks')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return { settingsId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['time_blocks', result.settingsId] });
    },
  });
}

export function useTimeBlocksBySettingsSlug(slug: string | undefined) {
  return useQuery({
    queryKey: ['time_blocks_public', slug],
    queryFn: async () => {
      if (!slug) return [];
      
      // First get the settings ID
      const { data: settings, error: settingsError } = await supabase
        .from('scheduling_settings')
        .select('id')
        .eq('booking_link_slug', slug)
        .maybeSingle();

      if (settingsError) throw settingsError;
      if (!settings) return [];

      // Then get the time blocks
      const { data, error } = await supabase
        .from('scheduling_time_blocks')
        .select('*')
        .eq('settings_id', settings.id)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;
      return data as TimeBlock[];
    },
    enabled: !!slug,
  });
}
