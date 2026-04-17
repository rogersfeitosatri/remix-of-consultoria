import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface SchedulingSettings {
  id: string;
  user_id: string;
  working_days: number[];
  working_hours_start: string;
  working_hours_end: string;
  slot_duration_minutes: number;
  booking_link_slug: string | null;
  min_advance_value: number;
  min_advance_unit: 'hours' | 'days';
  max_advance_days: number;
  created_at: string;
  updated_at: string;
}

export interface SchedulingBlock {
  id: string;
  user_id: string;
  block_type: 'full_day' | 'time_range';
  block_date: string;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
  created_at: string;
}

export interface Appointment {
  id: string;
  user_id: string;
  client_id: string;
  consultation_schedule_id: string | null;
  appointment_date: string;
  appointment_time: string;
  duration_minutes: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  notes: string | null;
  created_at: string;
  updated_at: string;
  client_name?: string;
}

export function useSchedulingSettings() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['scheduling_settings', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scheduling_settings')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        return {
          ...data,
          working_days: Array.isArray(data.working_days) ? data.working_days : JSON.parse(data.working_days as string),
        } as SchedulingSettings;
      }
      return null;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useSchedulingSettingsBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ['scheduling_settings_public', slug],
    queryFn: async () => {
      if (!slug) return null;
      
      const { data, error } = await supabase
        .from('scheduling_settings')
        .select('*')
        .eq('booking_link_slug', slug)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        return {
          ...data,
          working_days: Array.isArray(data.working_days) ? data.working_days : JSON.parse(data.working_days as string),
        } as SchedulingSettings;
      }
      return null;
    },
    enabled: !!slug,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useSchedulingBlocks(userId?: string) {
  const { user } = useAuth();
  const targetUserId = userId || user?.id;

  return useQuery({
    queryKey: ['scheduling_blocks', targetUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scheduling_blocks')
        .select('*')
        .eq('user_id', targetUserId!)
        .order('block_date', { ascending: true });

      if (error) throw error;
      return data as SchedulingBlock[];
    },
    enabled: !!targetUserId,
    staleTime: 1000 * 60 * 3, // 3 minutes
  });
}

export function useAppointments() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['appointments', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          clients (name)
        `)
        .order('appointment_date', { ascending: true });

      if (error) throw error;
      return data.map(a => ({
        ...a,
        client_name: a.clients?.name,
      })) as (Appointment & { client_name: string })[];
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

export function useAppointmentsByDate(userId: string, date: string) {
  return useQuery({
    queryKey: ['appointments_by_date', userId, date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('user_id', userId)
        .eq('appointment_date', date)
        .neq('status', 'cancelled');

      if (error) throw error;
      return data as Appointment[];
    },
    enabled: !!userId && !!date,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

export function useSaveSchedulingSettings() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (settings: Partial<SchedulingSettings>) => {
      // Check if settings exist
      const { data: existing } = await supabase
        .from('scheduling_settings')
        .select('id')
        .eq('user_id', user!.id)
        .maybeSingle();

      let settingsId = existing?.id;

      if (existing) {
        const { error } = await supabase
          .from('scheduling_settings')
          .update({
            ...settings,
            working_days: JSON.stringify(settings.working_days),
          })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { data: newSettings, error } = await supabase
          .from('scheduling_settings')
          .insert({
            user_id: user!.id,
            ...settings,
            working_days: JSON.stringify(settings.working_days),
          })
          .select('id')
          .single();
        if (error) throw error;
        settingsId = newSettings?.id;
      }

      // Remove time blocks for days that are no longer in working_days
      if (settingsId && settings.working_days) {
        const workingDays = settings.working_days;
        
        // Get all current time blocks
        const { data: currentTimeBlocks } = await supabase
          .from('scheduling_time_blocks')
          .select('id, day_of_week')
          .eq('settings_id', settingsId);
        
        if (currentTimeBlocks && currentTimeBlocks.length > 0) {
          // Find time blocks that are on days no longer in working_days
          const blocksToRemove = currentTimeBlocks.filter(
            tb => !workingDays.includes(tb.day_of_week)
          );
          
          if (blocksToRemove.length > 0) {
            const idsToRemove = blocksToRemove.map(b => b.id);
            const { error: deleteError } = await supabase
              .from('scheduling_time_blocks')
              .delete()
              .in('id', idsToRemove);
            
            if (deleteError) {
              console.error('Error removing orphan time blocks:', deleteError);
            }
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduling_settings'] });
      queryClient.invalidateQueries({ queryKey: ['time_blocks'] });
    },
  });
}

export function useAddSchedulingBlock() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (block: Omit<SchedulingBlock, 'id' | 'user_id' | 'created_at'>) => {
      const { error } = await supabase
        .from('scheduling_blocks')
        .insert({
          user_id: user!.id,
          ...block,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduling_blocks'] });
    },
  });
}

export function useDeleteSchedulingBlock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('scheduling_blocks')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduling_blocks'] });
    },
  });
}

export function useCreateAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (appointment: Omit<Appointment, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('appointments')
        .insert(appointment)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointments_by_date'] });
      queryClient.invalidateQueries({ queryKey: ['consultation_schedules'] });
    },
  });
}

export function useUpdateAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Appointment> & { id: string }) => {
      const { error } = await supabase
        .from('appointments')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointments_by_date'] });
    },
  });
}
