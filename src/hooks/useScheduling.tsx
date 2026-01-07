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
        const { error } = await supabase
          .from('scheduling_settings')
          .insert({
            user_id: user!.id,
            ...settings,
            working_days: JSON.stringify(settings.working_days),
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduling_settings'] });
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
