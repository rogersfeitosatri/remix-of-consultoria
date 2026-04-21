import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface BookingLogRow {
  id: string;
  client_id: string | null;
  to_phone: string;
  template_key: string | null;
  message_type: string | null;
  status: string;
  blocked_reason: string | null;
  triggered_by: string | null;
  consultation_schedule_id: string | null;
  error_message: string | null;
  created_at: string;
  clients?: { name: string } | null;
}

export interface PendingScheduleRow {
  id: string;
  client_id: string;
  scheduled_date: string;
  send_link_date: string;
  status: string;
  updated_at: string;
  clients?: { name: string; phone: string | null; email: string | null } | null;
}

const BOOKING_TEMPLATE_KEYS = [
  'weekly_booking_link',
  'booking_followup_v1',
  'consultation_reminder_24h_v1',
  'confirmation',
  'booking_invite',
];

/**
 * Hook unificado para a tela de Auditoria de Consultas.
 * Retorna 3 conjuntos de dados nas últimas 30 dias:
 *  - linksSemRetorno: schedules com link enviado (sent/link_sent) há > 3 dias sem appointment criado
 *  - falhasZapi: logs com status 'failed' relacionados a booking
 *  - bloqueados: logs com blocked_reason preenchido (duplicate_guard, frozen, etc.)
 */
export function useSchedulingAudit() {
  const { user } = useAuth();

  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceIso = since.toISOString();

  const failedQuery = useQuery({
    queryKey: ['scheduling-audit', 'failed', user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<BookingLogRow[]> => {
      const { data, error } = await supabase
        .from('whatsapp_message_logs')
        .select('id, client_id, to_phone, template_key, message_type, status, blocked_reason, triggered_by, consultation_schedule_id, error_message, created_at, clients(name)')
        .eq('user_id', user!.id)
        .eq('status', 'failed')
        .in('template_key', BOOKING_TEMPLATE_KEYS)
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data as any) || [];
    },
  });

  const blockedQuery = useQuery({
    queryKey: ['scheduling-audit', 'blocked', user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<BookingLogRow[]> => {
      const { data, error } = await supabase
        .from('whatsapp_message_logs')
        .select('id, client_id, to_phone, template_key, message_type, status, blocked_reason, triggered_by, consultation_schedule_id, error_message, created_at, clients(name)')
        .eq('user_id', user!.id)
        .not('blocked_reason', 'is', null)
        .in('template_key', BOOKING_TEMPLATE_KEYS)
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data as any) || [];
    },
  });

  const noReturnQuery = useQuery({
    queryKey: ['scheduling-audit', 'no-return', user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<PendingScheduleRow[]> => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 3);
      const cutoffStr = cutoff.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('consultation_schedules')
        .select('id, client_id, scheduled_date, send_link_date, status, updated_at, clients(name, phone, email)')
        .eq('user_id', user!.id)
        .in('status', ['sent', 'link_sent'])
        .lte('send_link_date', cutoffStr)
        .order('send_link_date', { ascending: true })
        .limit(100);
      if (error) throw error;
      return (data as any) || [];
    },
  });

  return {
    linksSemRetorno: noReturnQuery.data || [],
    falhasZapi: failedQuery.data || [],
    bloqueados: blockedQuery.data || [],
    isLoading: failedQuery.isLoading || blockedQuery.isLoading || noReturnQuery.isLoading,
    refetch: () => {
      failedQuery.refetch();
      blockedQuery.refetch();
      noReturnQuery.refetch();
    },
  };
}
