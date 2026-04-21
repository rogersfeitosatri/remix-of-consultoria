import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { differenceInCalendarDays, parseISO } from 'date-fns';

export type PeriodicityStatus = 'on_track' | 'attention' | 'late' | 'inactive';

export interface PeriodicityRow {
  client_id: string;
  client_name: string;
  is_active: boolean;
  is_frozen: boolean;
  plan_type: string;
  consultation_frequency: string | null;
  cadence_weeks: number | null;
  cadence_label: string;
  last_link_sent_at: string | null;
  next_send_date: string | null;
  days_to_next_send: number | null;
  status: PeriodicityStatus;
  last_completed_at: string | null;
  real_interval_days: number | null;
  deviation_days: number | null;
}

function cadenceFromFrequency(freq: string | null): { weeks: number | null; label: string } {
  if (!freq) return { weeks: null, label: '—' };
  if (freq === 'six_weeks' || freq === '6_weeks') return { weeks: 6, label: '6w' };
  if (freq === 'monthly' || freq === '4_weeks') return { weeks: 4, label: '4w' };
  return { weeks: null, label: freq };
}

function planLabel(client: any): string {
  if (!client.has_consultations) return 'só check-in';
  if (client.consultation_count === 1) return 'avulsa';
  const cad = cadenceFromFrequency(client.consultation_frequency).label;
  if (client.plan_type === 'premium') return `premium ${cad}`;
  return cad;
}

export function usePeriodicityControl() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['periodicity-control', user?.id],
    queryFn: async (): Promise<PeriodicityRow[]> => {
      if (!user?.id) return [];

      // Fetch clients
      const { data: clients, error: cErr } = await supabase
        .from('clients')
        .select('id, name, is_active, is_frozen, plan_type, consultation_frequency, consultation_count, has_consultations, end_date')
        .eq('user_id', user.id);
      if (cErr) throw cErr;

      const clientIds = (clients || []).map((c) => c.id);
      if (clientIds.length === 0) return [];

      // Fetch all schedules for these clients
      const { data: schedules } = await supabase
        .from('consultation_schedules')
        .select('id, client_id, scheduled_date, send_link_date, link_sent_at, status')
        .in('client_id', clientIds);

      // Fetch completed appointments
      const { data: appts } = await supabase
        .from('appointments')
        .select('id, client_id, appointment_date, status')
        .in('client_id', clientIds)
        .eq('status', 'completed');

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const rows: PeriodicityRow[] = (clients || []).map((client) => {
        const cadence = cadenceFromFrequency(client.consultation_frequency);

        const clientSchedules = (schedules || []).filter((s) => s.client_id === client.id);
        const clientAppts = (appts || [])
          .filter((a) => a.client_id === client.id)
          .sort((a, b) => b.appointment_date.localeCompare(a.appointment_date));

        // Last sent link
        const sentSchedules = clientSchedules
          .filter((s) => s.link_sent_at)
          .sort((a, b) => (b.link_sent_at || '').localeCompare(a.link_sent_at || ''));
        const lastSent = sentSchedules[0]?.link_sent_at || null;

        // Next pending send
        const pendingSchedules = clientSchedules
          .filter((s) => s.status === 'pending' && s.send_link_date)
          .sort((a, b) => a.send_link_date.localeCompare(b.send_link_date));
        const nextSend = pendingSchedules[0]?.send_link_date || null;

        // Last completed appointment
        const lastCompleted = clientAppts[0]?.appointment_date || null;

        // Days to next
        const daysToNext = nextSend
          ? differenceInCalendarDays(parseISO(nextSend), today)
          : null;

        // Real interval
        let realInterval: number | null = null;
        let deviation: number | null = null;
        if (lastCompleted && lastSent) {
          realInterval = differenceInCalendarDays(parseISO(lastCompleted), parseISO(lastSent));
          if (cadence.weeks) {
            deviation = Math.abs(realInterval - cadence.weeks * 7);
          }
        }

        // Status
        let status: PeriodicityStatus = 'on_track';
        const planExpired = client.end_date && parseISO(client.end_date) < today;
        if (!client.is_active || client.is_frozen || planExpired || !client.has_consultations) {
          status = 'inactive';
        } else if (daysToNext === null) {
          status = 'inactive';
        } else if (daysToNext < -3) {
          status = 'late';
        } else if (daysToNext < 0) {
          status = 'attention';
        } else {
          status = 'on_track';
        }

        return {
          client_id: client.id,
          client_name: client.name,
          is_active: !!client.is_active,
          is_frozen: !!client.is_frozen,
          plan_type: planLabel(client),
          consultation_frequency: client.consultation_frequency,
          cadence_weeks: cadence.weeks,
          cadence_label: cadence.label,
          last_link_sent_at: lastSent,
          next_send_date: nextSend,
          days_to_next_send: daysToNext,
          status,
          last_completed_at: lastCompleted,
          real_interval_days: realInterval,
          deviation_days: deviation,
        };
      });

      return rows.sort((a, b) => {
        // Order: late > attention > on_track > inactive
        const order: Record<PeriodicityStatus, number> = { late: 0, attention: 1, on_track: 2, inactive: 3 };
        return order[a.status] - order[b.status];
      });
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60,
  });
}
