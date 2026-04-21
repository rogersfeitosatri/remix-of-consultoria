import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface WeeklyLinkLog {
  id: string;
  client_id: string | null;
  consultation_schedule_id: string | null;
  template_key: string | null;
  status: string;
  blocked_reason: string | null;
  error_message: string | null;
  created_at: string;
  client_name?: string;
}

/**
 * Logs de envios de link de agendamento (booking) feitos via WhatsApp.
 * Usado para enriquecer o calendário admin com contadores semanais e
 * status visual nas segundas-feiras (✅ enviado, ❌ falha).
 *
 * Filtra por template_key contendo 'booking' (booking_link_v1, etc.)
 * dentro do range solicitado.
 */
export function useWeeklyLinkLogs(rangeStartISO: string, rangeEndISO: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['weekly-link-logs', user?.id, rangeStartISO, rangeEndISO],
    queryFn: async (): Promise<WeeklyLinkLog[]> => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('whatsapp_message_logs')
        .select('id, client_id, consultation_schedule_id, template_key, status, blocked_reason, error_message, created_at, clients(name)')
        .eq('user_id', user.id)
        .or('template_key.ilike.%booking%,template_key.ilike.%agendamento%')
        .gte('created_at', rangeStartISO)
        .lte('created_at', rangeEndISO)
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      return (data || []).map((r: any) => ({
        id: r.id,
        client_id: r.client_id,
        consultation_schedule_id: r.consultation_schedule_id,
        template_key: r.template_key,
        status: r.status,
        blocked_reason: r.blocked_reason,
        error_message: r.error_message,
        created_at: r.created_at,
        client_name: r.clients?.name,
      }));
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 2,
  });
}
