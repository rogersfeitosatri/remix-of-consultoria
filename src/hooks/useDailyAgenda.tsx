/**
 * ETAPA 2B — Agenda do dia (contexto, não fila).
 * Mostra o que acontece HOJE: consultas marcadas e compromissos com hora.
 * Atletas fora do estado operacional não aparecem.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getAthleteState } from '@/lib/athleteState';
import { toDateKey } from '@/lib/dashboardOperations';

export interface AgendaAppointment {
  id: string;
  clientId: string;
  clientName: string;
  time: string;
  durationMinutes: number;
  meetLink: string | null;
  status: string;
}

export function useDailyAgenda() {
  const { user } = useAuth();
  const today = toDateKey(new Date());

  const query = useQuery({
    queryKey: ['daily-agenda', user?.id, today],
    enabled: !!user?.id,
    staleTime: 30_000,
    refetchInterval: 120_000,
    queryFn: async (): Promise<AgendaAppointment[]> => {
      const { data, error } = await supabase
        .from('appointments')
        .select(
          'id, client_id, appointment_time, duration_minutes, google_meet_link, status, clients!inner(name, is_active, is_frozen, archived_at, ended_at, end_date, service_type)',
        )
        .eq('user_id', user!.id)
        .eq('appointment_date', today)
        .in('status', ['scheduled', 'confirmed'])
        .order('appointment_time');
      if (error) throw error;

      return (data || [])
        .filter((a: any) => getAthleteState(a.clients).canAppearInOperationalQueues)
        .map((a: any) => ({
          id: a.id,
          clientId: a.client_id,
          clientName: a.clients?.name || 'N/A',
          time: String(a.appointment_time).slice(0, 5),
          durationMinutes: a.duration_minutes,
          meetLink: a.google_meet_link,
          status: a.status,
        }));
    },
  });

  return {
    appointments: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}
