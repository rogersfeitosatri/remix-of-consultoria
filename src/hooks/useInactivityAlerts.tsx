import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { differenceInDays, parseISO, format } from 'date-fns';

export interface InactiveAthlete {
  id: string;
  name: string;
  phone: string | null;
  daysSinceLastInteraction: number;
  lastInteractionType: string;
  lastInteractionDate: string;
}

export function useInactivityAlerts(thresholdDays = 14) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['inactivity-alerts', user?.id, thresholdDays],
    queryFn: async () => {
      if (!user?.id) return [];

      // Get active clients
      const { data: clients } = await supabase
        .from('clients')
        .select('id, name, phone, start_date')
        .eq('is_active', true);

      if (!clients || clients.length === 0) return [];

      const results: InactiveAthlete[] = [];
      const today = new Date();

      for (const client of clients) {
        let lastDate: Date | null = null;
        let lastType = '';

        // Check last checkin
        const { data: lastCheckin } = await supabase
          .from('checkin_responses')
          .select('submitted_at')
          .eq('client_id', client.id)
          .order('submitted_at', { ascending: false })
          .limit(1);

        if (lastCheckin?.[0]) {
          const d = parseISO(lastCheckin[0].submitted_at);
          if (!lastDate || d > lastDate) { lastDate = d; lastType = 'Check-in'; }
        }

        // Check last appointment
        const { data: lastAppt } = await supabase
          .from('appointments')
          .select('appointment_date')
          .eq('client_id', client.id)
          .in('status', ['confirmed', 'completed'])
          .order('appointment_date', { ascending: false })
          .limit(1);

        if (lastAppt?.[0]) {
          const d = parseISO(lastAppt[0].appointment_date);
          if (!lastDate || d > lastDate) { lastDate = d; lastType = 'Consulta'; }
        }

        // Check anamnese
        const { data: lastAnamnese } = await supabase
          .from('anamnese_responses')
          .select('submitted_at')
          .eq('client_id', client.id)
          .order('submitted_at', { ascending: false })
          .limit(1);

        if (lastAnamnese?.[0]) {
          const d = parseISO(lastAnamnese[0].submitted_at);
          if (!lastDate || d > lastDate) { lastDate = d; lastType = 'Anamnese'; }
        }

        // Fallback to start_date
        if (!lastDate) {
          lastDate = parseISO(client.start_date);
          lastType = 'Cadastro';
        }

        const daysSince = differenceInDays(today, lastDate);
        if (daysSince >= thresholdDays) {
          results.push({
            id: client.id,
            name: client.name,
            phone: client.phone,
            daysSinceLastInteraction: daysSince,
            lastInteractionType: lastType,
            lastInteractionDate: format(lastDate, 'dd/MM/yyyy'),
          });
        }
      }

      return results.sort((a, b) => b.daysSinceLastInteraction - a.daysSinceLastInteraction);
    },
    enabled: !!user?.id,
    refetchInterval: 300000,
  });
}
