import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { addWeeks, isPast, differenceInDays } from 'date-fns';

export interface DietAdjustmentAlert {
  id: string;
  client_id: string;
  user_id: string;
  last_adjustment_at: string | null;
  next_alert_at: string | null;
  status: 'pending' | 'completed';
  created_at: string;
  updated_at: string;
  client?: {
    id: string;
    name: string;
    plan_type: string;
    consultation_count: number | null;
    is_active: boolean;
  };
}

export interface PendingDietAlert {
  client_id: string;
  client_name: string;
  plan_type: string;
  consultation_count: number | null;
  checkin_frequency: string | null;
  last_adjustment_at: string | null;
  next_alert_at: string | null;
  is_pending: boolean;
  alert_id: string | null;
  last_checkin_at: string | null;
  days_since_adjustment: number | null;
}

export function useDietAdjustmentAlerts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['diet-adjustment-alerts', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('diet_adjustment_alerts')
        .select(`
          *,
          client:clients!diet_adjustment_alerts_client_id_fkey (
            id,
            name,
            plan_type,
            consultation_count,
            is_active
          )
        `)
        .order('next_alert_at', { ascending: true });

      if (error) throw error;
      return data as DietAdjustmentAlert[];
    },
    enabled: !!user,
  });
}

export function usePendingDietAlerts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['pending-diet-alerts', user?.id],
    queryFn: async () => {
      // Fetch eligible clients: Consultoria or Consulta Única, with monthly/biweekly checkin
      const { data: eligibleClients, error: clientsError } = await supabase
        .from('clients')
        .select('id, name, plan_type, consultation_count, consultation_frequency, checkin_frequency, is_active')
        .eq('is_active', true)
        .or('plan_type.eq.consultoria,plan_type.eq.consulta_unica');

      if (clientsError) throw clientsError;

      // Fetch existing alerts
      const { data: alerts, error: alertsError } = await supabase
        .from('diet_adjustment_alerts')
        .select('*');

      if (alertsError) throw alertsError;

      // Filter: only monthly or biweekly checkin, no recurring consultations
      const filtered = (eligibleClients || []).filter(c => {
        if (c.consultation_frequency) return false;
        const freq = c.checkin_frequency;
        return freq === 'monthly' || freq === 'biweekly';
      });

      if (filtered.length === 0) return [];

      // Fetch last checkin response for each client
      const clientIds = filtered.map(c => c.id);
      const { data: checkinData } = await supabase
        .from('checkin_responses')
        .select('client_id, submitted_at')
        .in('client_id', clientIds)
        .order('submitted_at', { ascending: false });

      const lastCheckinMap = new Map<string, string>();
      for (const cr of checkinData || []) {
        if (cr.client_id && !lastCheckinMap.has(cr.client_id)) {
          lastCheckinMap.set(cr.client_id, cr.submitted_at);
        }
      }

      const now = new Date();
      const pendingAlerts: PendingDietAlert[] = [];

      for (const client of filtered) {
        const existingAlert = alerts?.find(a => a.client_id === client.id);
        const lastCheckinAt = lastCheckinMap.get(client.id) || null;

        if (!existingAlert) {
          pendingAlerts.push({
            client_id: client.id,
            client_name: client.name,
            plan_type: client.plan_type,
            consultation_count: client.consultation_count,
            checkin_frequency: client.checkin_frequency,
            last_adjustment_at: null,
            next_alert_at: null,
            is_pending: true,
            alert_id: null,
            last_checkin_at: lastCheckinAt,
            days_since_adjustment: null,
          });
        } else {
          const nextAlertDate = existingAlert.next_alert_at ? new Date(existingAlert.next_alert_at) : null;
          const isPending = !nextAlertDate || isPast(nextAlertDate);

          if (isPending) {
            const daysSince = existingAlert.last_adjustment_at
              ? differenceInDays(now, new Date(existingAlert.last_adjustment_at))
              : null;

            pendingAlerts.push({
              client_id: client.id,
              client_name: client.name,
              plan_type: client.plan_type,
              consultation_count: client.consultation_count,
              checkin_frequency: client.checkin_frequency,
              last_adjustment_at: existingAlert.last_adjustment_at,
              next_alert_at: existingAlert.next_alert_at,
              is_pending: true,
              alert_id: existingAlert.id,
              last_checkin_at: lastCheckinAt,
              days_since_adjustment: daysSince,
            });
          }
        }
      }

      // Sort: never adjusted first, then by days_since_adjustment descending
      pendingAlerts.sort((a, b) => {
        if (a.days_since_adjustment === null && b.days_since_adjustment !== null) return -1;
        if (a.days_since_adjustment !== null && b.days_since_adjustment === null) return 1;
        if (a.days_since_adjustment === null && b.days_since_adjustment === null) return 0;
        return (b.days_since_adjustment ?? 0) - (a.days_since_adjustment ?? 0);
      });

      return pendingAlerts;
    },
    enabled: !!user,
  });
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
      queryClient.invalidateQueries({ queryKey: ['pending-diet-alerts'] });
    },
  });
}
