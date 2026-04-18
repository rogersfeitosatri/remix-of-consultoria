import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import {
  addMonths,
  startOfMonth,
  endOfMonth,
  nextMonday,
  previousMonday,
  isMonday,
  differenceInDays,
  isBefore,
  isAfter,
  format,
  parseISO,
  addWeeks,
} from 'date-fns';

export interface DietAdjustmentAlert {
  id: string;
  client_id: string;
  user_id: string;
  last_adjustment_at: string | null;
  next_alert_at: string | null;
  status: 'pending' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface DietCycleEntry {
  client_id: string;
  client_name: string;
  plan_type: string;
  checkin_frequency: string | null;
  start_date: string;
  /** The exact monthly anniversary date */
  anniversary_date: Date;
  /** The nearest Monday to the anniversary */
  adjustment_monday: Date;
  /** How many months since start */
  cycle_number: number;
  /** Whether the adjustment was already marked done */
  is_done: boolean;
  alert_id: string | null;
  last_adjustment_at: string | null;
}

/**
 * Find the nearest Monday to a given date.
 */
function nearestMonday(date: Date): Date {
  if (isMonday(date)) return date;
  const prev = previousMonday(date);
  const next = nextMonday(date);
  const diffPrev = Math.abs(differenceInDays(date, prev));
  const diffNext = Math.abs(differenceInDays(next, date));
  return diffPrev <= diffNext ? prev : next;
}

/**
 * Calculate all monthly cycle Mondays for a given athlete within a date range,
 * stopping 30 days before planEndDate.
 */
function getAthleteCycleMondays(
  startDate: Date,
  rangeStart: Date,
  rangeEnd: Date,
  planEndDate: Date,
): { anniversary: Date; monday: Date; cycleNumber: number }[] {
  const results: { anniversary: Date; monday: Date; cycleNumber: number }[] = [];
  // Stop generating cycles 30 days before plan end
  const cutoff = new Date(planEndDate);
  cutoff.setDate(cutoff.getDate() - 30);

  for (let i = 1; i <= 36; i++) {
    const anniversary = addMonths(startDate, i);
    // Stop if anniversary is past the cutoff (30 days before plan end)
    if (isAfter(anniversary, cutoff)) break;
    // Stop if past our display range
    if (isAfter(anniversary, rangeEnd)) break;

    const monday = nearestMonday(anniversary);
    // Include if the Monday falls within the display range
    if (!isBefore(monday, rangeStart) && !isAfter(monday, rangeEnd)) {
      results.push({ anniversary, monday, cycleNumber: i });
    }
  }
  return results;
}

export function useDietCycleAlerts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['diet-cycle-alerts', user?.id],
    queryFn: async () => {
      // 1. Fetch eligible clients (exclude frozen)
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('id, name, plan_type, checkin_frequency, consultation_frequency, consultation_count, start_date, end_date, is_active')
        .eq('is_active', true)
        .eq('is_frozen', false)
        .or('plan_type.eq.consultoria,plan_type.eq.consulta_unica');

      if (clientsError) throw clientsError;

      // All consultoria/consulta_unica active athletes are eligible for monthly diet adjustments
      const eligible = (clients || []).filter(c => c.start_date && c.end_date);

      if (eligible.length === 0) return [];

      // 2. Fetch existing diet adjustment alerts
      const clientIds = eligible.map(c => c.id);
      const { data: alerts } = await supabase
        .from('diet_adjustment_alerts')
        .select('*')
        .in('client_id', clientIds);

      const alertMap = new Map<string, any>();
      for (const a of alerts || []) {
        alertMap.set(a.client_id, a);
      }

      // 3. Calculate cycles for current month
      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);
      // Extend range a bit to catch Mondays that spill over
      const rangeStart = new Date(monthStart);
      rangeStart.setDate(rangeStart.getDate() - 3);
      const rangeEnd = new Date(monthEnd);
      rangeEnd.setDate(rangeEnd.getDate() + 3);

      const entries: DietCycleEntry[] = [];

      for (const client of eligible) {
        if (!client.start_date || !client.end_date) continue;
        const startDate = parseISO(client.start_date);
        const planEndDate = parseISO(client.end_date);
        const cycles = getAthleteCycleMondays(startDate, rangeStart, rangeEnd, planEndDate);

        for (const cycle of cycles) {
          const existingAlert = alertMap.get(client.id);
          // Check if adjustment was done within 7 days of this Monday
          let isDone = false;
          if (existingAlert?.last_adjustment_at) {
            const lastAdj = new Date(existingAlert.last_adjustment_at);
            const diff = Math.abs(differenceInDays(lastAdj, cycle.monday));
            isDone = diff <= 7;
          }

          entries.push({
            client_id: client.id,
            client_name: client.name,
            plan_type: client.plan_type,
            checkin_frequency: client.checkin_frequency,
            start_date: client.start_date,
            anniversary_date: cycle.anniversary,
            adjustment_monday: cycle.monday,
            cycle_number: cycle.cycleNumber,
            is_done: isDone,
            alert_id: existingAlert?.id || null,
            last_adjustment_at: existingAlert?.last_adjustment_at || null,
          });
        }
      }

      // Sort by monday date ascending
      entries.sort((a, b) => a.adjustment_monday.getTime() - b.adjustment_monday.getTime());

      return entries;
    },
    enabled: !!user,
  });
}

// Legacy alias — kept for backward compat, points to same query
export function usePendingDietAlerts() {
  return useDietCycleAlerts();
}

export function useMarkDietAdjustmentDone() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ clientId, alertId }: { clientId: string; alertId: string | null }) => {
      if (!user) throw new Error('Not authenticated');

      const now = new Date();
      const nextAlertAt = addWeeks(now, 4);

      if (alertId) {
        const { data, error } = await supabase
          .from('diet_adjustment_alerts')
          .update({
            last_adjustment_at: now.toISOString(),
            next_alert_at: nextAlertAt.toISOString(),
            status: 'completed',
          })
          .eq('id', alertId)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('diet_adjustment_alerts')
          .insert({
            client_id: clientId,
            user_id: user.id,
            last_adjustment_at: now.toISOString(),
            next_alert_at: nextAlertAt.toISOString(),
            status: 'completed',
          })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diet-adjustment-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['diet-cycle-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['pending-diet-alerts'] });
    },
  });
}
