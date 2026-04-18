import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { format } from 'date-fns';

export interface TodayAppointment {
  id: string;
  client_name: string;
  client_id: string;
  appointment_time: string;
  duration_minutes: number;
  google_meet_link: string | null;
  status: string;
}

export interface TodayTask {
  id: string;
  title: string;
  client_id: string | null;
  client_name: string | null;
  due_date: string | null;
  task_type: string;
  priority: string;
  status: string;
  is_overdue: boolean;
}

export interface UrgentAthlete {
  id: string;
  name: string;
  phone: string | null;
  reason: string;
  days_left: number;
}

export interface PendingCheckinItem {
  client_id: string;
  client_name: string;
  days_waiting: number;
  checkin_frequency: string;
}

export function useMyDayToday() {
  const { user } = useAuth();
  const today = format(new Date(), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['my-day-today', user?.id, today],
    queryFn: async () => {
      if (!user?.id) return null;

      // 1. Today's appointments
      const { data: appointments } = await supabase
        .from('appointments')
        .select('id, client_id, appointment_time, duration_minutes, google_meet_link, status, clients!inner(name)')
        .eq('user_id', user.id)
        .eq('appointment_date', today)
        .in('status', ['scheduled', 'confirmed'])
        .order('appointment_time');

      const todayAppointments: TodayAppointment[] = (appointments || []).map((a: any) => ({
        id: a.id,
        client_name: a.clients?.name || 'N/A',
        client_id: a.client_id,
        appointment_time: a.appointment_time,
        duration_minutes: a.duration_minutes,
        google_meet_link: a.google_meet_link,
        status: a.status,
      }));

      // 2. Tasks due today or overdue (not done)
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, title, client_id, due_date, task_type, priority, status')
        .eq('user_id', user.id)
        .in('status', ['pending', 'in_progress'])
        .eq('is_archived', false)
        .lte('due_date', today)
        .order('due_date');

      // Get client names for tasks
      const taskClientIds = [...new Set((tasks || []).filter((t: any) => t.client_id).map((t: any) => t.client_id))];
      let clientMap: Record<string, string> = {};
      if (taskClientIds.length > 0) {
        const { data: clients } = await supabase
          .from('clients')
          .select('id, name')
          .in('id', taskClientIds);
        clientMap = (clients || []).reduce((acc: any, c: any) => ({ ...acc, [c.id]: c.name }), {});
      }

      const todayTasks: TodayTask[] = (tasks || []).map((t: any) => ({
        id: t.id,
        title: t.title,
        client_id: t.client_id,
        client_name: t.client_id ? clientMap[t.client_id] || null : null,
        due_date: t.due_date,
        task_type: t.task_type,
        priority: t.priority,
        status: t.status,
        is_overdue: t.due_date < today,
      }));

      // 3. Pending check-in responses (dispatches sent but not responded)
      const { data: pendingDispatches } = await supabase
        .from('checkin_dispatches')
        .select('client_id, sent_at, clients!inner(name, checkin_frequency)')
        .eq('user_id', user.id)
        .in('status', ['sent', 'pending'])
        .order('sent_at', { ascending: true })
        .limit(20);

      const checkinMap = new Map<string, PendingCheckinItem>();
      for (const d of pendingDispatches || []) {
        const c = d as any;
        if (!checkinMap.has(c.client_id)) {
          const daysWaiting = Math.floor((Date.now() - new Date(c.sent_at).getTime()) / (1000 * 60 * 60 * 24));
          checkinMap.set(c.client_id, {
            client_id: c.client_id,
            client_name: c.clients?.name || 'N/A',
            days_waiting: daysWaiting,
            checkin_frequency: c.clients?.checkin_frequency || 'monthly',
          });
        }
      }
      const pendingCheckins = Array.from(checkinMap.values()).sort((a, b) => b.days_waiting - a.days_waiting).slice(0, 5);

      // 4. Urgent athletes (plan expiring in 7 days, active and not frozen)
      const sevenDaysLater = format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
      const { data: expiringClients } = await supabase
        .from('clients')
        .select('id, name, phone, end_date')
        .eq('is_active', true)
        .eq('is_frozen', false)
        .lte('end_date', sevenDaysLater)
        .gte('end_date', today)
        .order('end_date');

      const urgentAthletes: UrgentAthlete[] = (expiringClients || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        reason: 'Plano vencendo',
        days_left: Math.ceil((new Date(c.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      }));

      return {
        appointments: todayAppointments,
        tasks: todayTasks,
        pendingCheckins,
        urgentAthletes,
      };
    },
    enabled: !!user?.id,
    refetchInterval: 120000,
  });
}
