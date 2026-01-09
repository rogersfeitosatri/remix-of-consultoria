import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { addDays, nextMonday, format, parseISO, differenceInDays, isMonday, isBefore, startOfDay } from 'date-fns';

export interface ScheduledCheckin {
  id: string;
  client_id: string;
  user_id: string;
  form_id: string | null;
  scheduled_send_date: string;
  scheduled_send_time: string;
  status: 'pending' | 'sent' | 'skipped' | 'completed';
  sent_at: string | null;
  response_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  client_name?: string;
}

// Helper to calculate the first valid Monday for checkin
// Rule: If next Monday is less than 6 days away, skip to the following Monday
export function calculateFirstCheckinMonday(startDate: Date): Date {
  const today = startOfDay(new Date());
  const baseDate = isBefore(startDate, today) ? today : startOfDay(startDate);
  
  // Get the next Monday from baseDate
  let firstMonday = isMonday(baseDate) ? baseDate : nextMonday(baseDate);
  
  // Calculate days until this Monday
  const daysUntilMonday = differenceInDays(firstMonday, baseDate);
  
  // If less than 6 days until the Monday, skip to the next Monday
  if (daysUntilMonday < 6) {
    firstMonday = addDays(firstMonday, 7);
  }
  
  return firstMonday;
}

// Generate scheduled checkins based on client's plan and frequency
export function generateCheckinSchedules(
  userId: string,
  clientId: string,
  startDate: string,
  endDate: string,
  checkinFrequency: string,
  formId?: string
): Omit<ScheduledCheckin, 'id' | 'created_at' | 'updated_at' | 'client_name'>[] {
  const schedules: Omit<ScheduledCheckin, 'id' | 'created_at' | 'updated_at' | 'client_name'>[] = [];
  
  const planStart = parseISO(startDate);
  const planEnd = parseISO(endDate);
  
  // Calculate first valid Monday
  let currentMonday = calculateFirstCheckinMonday(planStart);
  
  // Frequency in weeks
  const frequencyWeeks: Record<string, number> = {
    daily: 0, // Special case - still send on Mondays
    weekly: 1,
    biweekly: 2,
    three_weeks: 3,
    monthly: 4,
    bimonthly: 8,
    quarterly: 12,
  };
  
  const weeksBetween = frequencyWeeks[checkinFrequency] || 1;
  
  // For daily frequency, we still send only on Mondays at 07:00
  // but we track it as weekly
  const effectiveWeeksBetween = weeksBetween === 0 ? 1 : weeksBetween;
  
  while (isBefore(currentMonday, planEnd) || format(currentMonday, 'yyyy-MM-dd') === format(planEnd, 'yyyy-MM-dd')) {
    schedules.push({
      client_id: clientId,
      user_id: userId,
      form_id: formId || null,
      scheduled_send_date: format(currentMonday, 'yyyy-MM-dd'),
      scheduled_send_time: '07:00:00',
      status: 'pending',
      sent_at: null,
      response_id: null,
      notes: null,
    });
    
    // Move to next scheduled Monday
    currentMonday = addDays(currentMonday, effectiveWeeksBetween * 7);
  }
  
  return schedules;
}

export function useScheduledCheckins() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['scheduled_checkins', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scheduled_checkins')
        .select(`
          *,
          clients (name)
        `)
        .order('scheduled_send_date', { ascending: true });

      if (error) throw error;
      return data.map(s => ({
        ...s,
        client_name: s.clients?.name,
      })) as ScheduledCheckin[];
    },
    enabled: !!user,
  });
}

export function useScheduledCheckinsForClient(clientId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['scheduled_checkins', 'client', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      
      const { data, error } = await supabase
        .from('scheduled_checkins')
        .select('*')
        .eq('client_id', clientId)
        .order('scheduled_send_date', { ascending: true });

      if (error) throw error;
      return data as ScheduledCheckin[];
    },
    enabled: !!user && !!clientId,
  });
}

export function useAddScheduledCheckin() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<ScheduledCheckin, 'id' | 'created_at' | 'updated_at' | 'client_name'>) => {
      if (!user) throw new Error('Not authenticated');

      const { data: result, error } = await supabase
        .from('scheduled_checkins')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled_checkins'] });
    },
  });
}

export function useUpdateScheduledCheckin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ScheduledCheckin> & { id: string }) => {
      const { data, error } = await supabase
        .from('scheduled_checkins')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled_checkins'] });
    },
  });
}

export function useDeleteScheduledCheckin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('scheduled_checkins')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled_checkins'] });
    },
  });
}

export function useBulkCreateScheduledCheckins() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (schedules: Omit<ScheduledCheckin, 'id' | 'created_at' | 'updated_at' | 'client_name'>[]) => {
      if (schedules.length === 0) return [];

      const { data, error } = await supabase
        .from('scheduled_checkins')
        .insert(schedules)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled_checkins'] });
    },
  });
}

export function useDeleteScheduledCheckinsForClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (clientId: string) => {
      const { error } = await supabase
        .from('scheduled_checkins')
        .delete()
        .eq('client_id', clientId)
        .eq('status', 'pending'); // Only delete pending ones

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled_checkins'] });
    },
  });
}

// Helper functions for views
export function getUpcomingScheduledCheckins(checkins: ScheduledCheckin[], days: number = 7): ScheduledCheckin[] {
  const today = startOfDay(new Date());
  const futureDate = addDays(today, days);
  
  return checkins.filter(c => {
    if (c.status !== 'pending') return false;
    const scheduleDate = parseISO(c.scheduled_send_date);
    return !isBefore(scheduleDate, today) && isBefore(scheduleDate, futureDate);
  });
}

export function getPastScheduledCheckins(checkins: ScheduledCheckin[]): ScheduledCheckin[] {
  const today = startOfDay(new Date());
  
  return checkins.filter(c => {
    const scheduleDate = parseISO(c.scheduled_send_date);
    return isBefore(scheduleDate, today);
  });
}

export function getFutureScheduledCheckins(checkins: ScheduledCheckin[]): ScheduledCheckin[] {
  const today = startOfDay(new Date());
  
  return checkins.filter(c => {
    if (c.status !== 'pending') return false;
    const scheduleDate = parseISO(c.scheduled_send_date);
    return !isBefore(scheduleDate, today);
  });
}
