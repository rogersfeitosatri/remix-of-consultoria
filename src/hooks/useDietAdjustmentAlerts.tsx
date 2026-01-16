import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { addWeeks, isPast } from 'date-fns';

export interface DietAdjustmentAlert {
  id: string;
  client_id: string;
  user_id: string;
  last_adjustment_at: string | null;
  next_alert_at: string | null;
  status: 'pending' | 'completed';
  created_at: string;
  updated_at: string;
  // Joined fields
  client?: {
    id: string;
    name: string;
    plan_type: string;
    consultation_count: number | null;
    is_active: boolean;
  };
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
      // Fetch eligible clients: Consultoria or Premium with 0 or 1 consultation
      const { data: eligibleClients, error: clientsError } = await supabase
        .from('clients')
        .select('id, name, plan_type, consultation_count, is_active')
        .eq('is_active', true)
        .in('plan_type', ['consultoria', 'premium'])
        .or('consultation_count.is.null,consultation_count.lte.1');

      if (clientsError) throw clientsError;

      // Fetch existing alerts
      const { data: alerts, error: alertsError } = await supabase
        .from('diet_adjustment_alerts')
        .select('*');

      if (alertsError) throw alertsError;

      const now = new Date();
      const pendingAlerts: Array<{
        client_id: string;
        client_name: string;
        plan_type: string;
        consultation_count: number | null;
        last_adjustment_at: string | null;
        next_alert_at: string | null;
        is_pending: boolean;
        alert_id: string | null;
      }> = [];

      for (const client of eligibleClients || []) {
        const existingAlert = alerts?.find(a => a.client_id === client.id);

        if (!existingAlert) {
          // No alert exists - needs one
          pendingAlerts.push({
            client_id: client.id,
            client_name: client.name,
            plan_type: client.plan_type,
            consultation_count: client.consultation_count,
            last_adjustment_at: null,
            next_alert_at: null,
            is_pending: true,
            alert_id: null,
          });
        } else {
          // Check if alert is due (next_alert_at is null or in the past)
          const nextAlertDate = existingAlert.next_alert_at ? new Date(existingAlert.next_alert_at) : null;
          const isPending = !nextAlertDate || isPast(nextAlertDate);

          if (isPending) {
            pendingAlerts.push({
              client_id: client.id,
              client_name: client.name,
              plan_type: client.plan_type,
              consultation_count: client.consultation_count,
              last_adjustment_at: existingAlert.last_adjustment_at,
              next_alert_at: existingAlert.next_alert_at,
              is_pending: true,
              alert_id: existingAlert.id,
            });
          }
        }
      }

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
      const nextAlertAt = addWeeks(now, 4); // 4 weeks from now

      if (alertId) {
        // Update existing alert
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
        // Create new alert
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
