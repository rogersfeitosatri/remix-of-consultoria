import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { differenceInCalendarDays, parseISO } from 'date-fns';

export type PeriodicityStatus =
  | 'on_track'   // 🟢 |desvio| <= 3
  | 'attention'  // 🟡 4-7
  | 'late'       // 🔴 > 7
  | 'no_data'    // ⚫ <2 link_sent_at
  | 'frozen'     // ⚫ congelado
  | 'inactive';

export interface PeriodicityRow {
  client_id: string;
  client_name: string;
  is_active: boolean;
  is_frozen: boolean;
  plan_type: string;
  consultation_frequency: string | null;
  cadence_weeks: number | null;
  cadence_days: number | null;
  cadence_label: string;
  last_link_sent_at: string | null;
  previous_link_sent_at: string | null;
  next_send_date: string | null;
  next_pending_schedule_id: string | null;
  pending_schedule_ids: string[];
  days_to_next_send: number | null;
  status: PeriodicityStatus;
  last_completed_at: string | null;
  real_interval_days: number | null;
  deviation_days: number | null;
  has_completed_for_interval: boolean;
}

/** ETAPA 4B: cadência sempre em múltiplos de semana (fonte canônica: periodicity.ts). */
function cadenceFromFrequency(freq: string | null): { weeks: number | null; days: number | null; label: string } {
  if (!freq) return { weeks: null, days: null, label: '—' };
  if (freq === 'six_weeks' || freq === '6_weeks') return { weeks: 6, days: 42, label: '6w (42d)' };
  if (freq === '4_weeks') return { weeks: 4, days: 28, label: '4w (28d)' };
  const weeks = consultationCadenceWeeks(freq);
  return { weeks, days: weeks * 7, label: `${weeks}w (${weeks * 7}d)` };
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

      const { data: clients, error: cErr } = await supabase
        .from('clients')
        .select('id, name, is_active, is_frozen, plan_type, consultation_frequency, consultation_count, has_consultations, end_date, athlete_status')
        .eq('user_id', user.id);
      if (cErr) throw cErr;

      const clientIds = (clients || []).map((c) => c.id);
      if (clientIds.length === 0) return [];

      const { data: schedules } = await supabase
        .from('consultation_schedules')
        .select('id, client_id, scheduled_date, send_link_date, link_sent_at, status, appointment_id')
        .in('client_id', clientIds);

      const { data: appts } = await supabase
        .from('appointments')
        .select('id, client_id, appointment_date, status')
        .in('client_id', clientIds)
        .eq('status', 'completed');

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const rows: PeriodicityRow[] = (clients || [])
        // Excluir avulsa / single conforme regra
        .filter((c) => !(c.consultation_count === 1))
        .filter((c) => !!c.has_consultations)
        .map((client) => {
          const cadence = cadenceFromFrequency(client.consultation_frequency);

          const clientSchedules = (schedules || []).filter((s) => s.client_id === client.id);
          const clientAppts = (appts || [])
            .filter((a) => a.client_id === client.id)
            .sort((a, b) => b.appointment_date.localeCompare(a.appointment_date));

          // Sent (com link_sent_at) — ordenados desc
          const sentSchedules = clientSchedules
            .filter((s) => s.link_sent_at)
            .sort((a, b) => (b.link_sent_at || '').localeCompare(a.link_sent_at || ''));
          const lastSent = sentSchedules[0]?.link_sent_at || null;
          const prevSent = sentSchedules[1]?.link_sent_at || null;

          // Próximo pending por send_link_date
          const pendingSchedules = clientSchedules
            .filter((s) => s.status === 'pending' && s.send_link_date)
            .sort((a, b) => a.send_link_date.localeCompare(b.send_link_date));
          const nextPending = pendingSchedules[0];
          const nextSend = nextPending?.send_link_date || null;

          const lastCompleted = clientAppts[0]?.appointment_date || null;

          const daysToNext = nextSend
            ? differenceInCalendarDays(parseISO(nextSend), today)
            : null;

          // Intervalo real entre os dois últimos link_sent_at
          let realInterval: number | null = null;
          let deviation: number | null = null;
          let hasCompletedForInterval = false;
          if (lastSent && prevSent) {
            realInterval = Math.abs(
              differenceInCalendarDays(parseISO(lastSent), parseISO(prevSent))
            );
            if (cadence.days) deviation = realInterval - cadence.days;
            // Existe ao menos uma consulta completed associada aos 2 últimos sent?
            const top2Ids = [sentSchedules[0]?.appointment_id, sentSchedules[1]?.appointment_id].filter(Boolean);
            hasCompletedForInterval = clientAppts.some((a) => top2Ids.includes(a.id));
          }

          // Status
          let status: PeriodicityStatus;
          const planExpired = client.end_date && parseISO(client.end_date) < today;

          if (client.is_frozen) {
            status = 'frozen';
          } else if (!client.is_active || planExpired || client.athlete_status === 'inactive' || client.athlete_status === 'plan_completed') {
            status = 'inactive';
          } else if (deviation === null) {
            status = 'no_data';
          } else {
            const abs = Math.abs(deviation);
            if (abs <= 3) status = 'on_track';
            else if (abs <= 7) status = 'attention';
            else status = 'late';
          }

          return {
            client_id: client.id,
            client_name: client.name,
            is_active: !!client.is_active,
            is_frozen: !!client.is_frozen,
            plan_type: planLabel(client),
            consultation_frequency: client.consultation_frequency,
            cadence_weeks: cadence.weeks,
            cadence_days: cadence.days,
            cadence_label: cadence.label,
            last_link_sent_at: lastSent,
            previous_link_sent_at: prevSent,
            next_send_date: nextSend,
            next_pending_schedule_id: nextPending?.id || null,
            pending_schedule_ids: pendingSchedules.map((p) => p.id),
            days_to_next_send: daysToNext,
            status,
            last_completed_at: lastCompleted,
            real_interval_days: realInterval,
            deviation_days: deviation,
            has_completed_for_interval: hasCompletedForInterval,
          };
        });

      const order: Record<PeriodicityStatus, number> = {
        late: 0, attention: 1, on_track: 2, no_data: 3, frozen: 4, inactive: 5,
      };
      return rows.sort((a, b) => order[a.status] - order[b.status]);
    },
    enabled: !!user?.id,
    staleTime: 1000 * 30,
  });
}
