import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { startOfWeek, endOfWeek, subWeeks, format } from 'date-fns';

export interface WeeklyReport {
  tasksCompleted: number;
  tasksPending: number;
  checkinsProcessed: number;
  consultationsHeld: number;
  athletesContacted: number;
  totalAthletes: number;
  weekLabel: string;
}

export function useWeeklyReport() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['weekly-report', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const lastWeekStart = startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 });
      const lastWeekEnd = endOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 });
      const startStr = format(lastWeekStart, 'yyyy-MM-dd');
      const endStr = format(lastWeekEnd, 'yyyy-MM-dd');

      const [tasksRes, checkinsRes, appointmentsRes, clientsRes] = await Promise.all([
        supabase.from('tasks').select('id, status, completed_at')
          .eq('user_id', user.id)
          .gte('updated_at', `${startStr}T00:00:00`)
          .lte('updated_at', `${endStr}T23:59:59`),
        supabase.from('checkin_responses').select('id, submitted_at')
          .gte('submitted_at', `${startStr}T00:00:00`)
          .lte('submitted_at', `${endStr}T23:59:59`),
        supabase.from('appointments').select('id, status, appointment_date')
          .eq('user_id', user.id)
          .gte('appointment_date', startStr)
          .lte('appointment_date', endStr)
          .in('status', ['confirmed', 'completed']),
        supabase.from('clients').select('id').eq('is_active', true),
      ]);

      const tasks = tasksRes.data || [];
      const completed = tasks.filter((t: any) => t.status === 'done').length;
      const pending = tasks.filter((t: any) => t.status !== 'done').length;

      return {
        tasksCompleted: completed,
        tasksPending: pending,
        checkinsProcessed: (checkinsRes.data || []).length,
        consultationsHeld: (appointmentsRes.data || []).length,
        athletesContacted: completed, // approximation
        totalAthletes: (clientsRes.data || []).length,
        weekLabel: `${format(lastWeekStart, 'dd/MM')} - ${format(lastWeekEnd, 'dd/MM')}`,
      } as WeeklyReport;
    },
    enabled: !!user?.id,
  });
}
