import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface AthleteResponseStatus {
  clientId: string;
  clientName: string;
  checkinFrequency: string;
  unrespondedCount: number;
  lastSentAt: string;
}

export function useCheckinResponseStatus() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['checkin-response-status', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Get active clients with check-in enabled
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('id, name, checkin_frequency, has_checkin')
        .eq('is_active', true)
        .eq('has_checkin', true)
        .in('checkin_frequency', ['weekly', 'biweekly', 'monthly']);

      if (clientsError) throw clientsError;
      if (!clients || clients.length === 0) return [];

      const results: AthleteResponseStatus[] = [];

      // For each client, count unresponded dispatches
      for (const client of clients) {
        const { data: dispatches, error: dispatchError } = await supabase
          .from('checkin_dispatches')
          .select('id, sent_at, client_id')
          .eq('client_id', client.id)
          .eq('user_id', user.id)
          .in('status', ['sent', 'pending'])
          .order('sent_at', { ascending: false });

        if (dispatchError) continue;
        if (!dispatches || dispatches.length === 0) continue;

        // Check response thresholds based on frequency
        let threshold = 0;
        switch (client.checkin_frequency) {
          case 'weekly':
            threshold = 2; // 2+ unresponded
            break;
          case 'biweekly':
          case 'monthly':
            threshold = 1; // 1+ unresponded
            break;
        }

        const unrespondedCount = dispatches.length;

        if (unrespondedCount >= threshold) {
          results.push({
            clientId: client.id,
            clientName: client.name,
            checkinFrequency: client.checkin_frequency,
            unrespondedCount,
            lastSentAt: dispatches[0].sent_at,
          });
        }
      }

      // Sort by unresponded count (descending)
      return results.sort((a, b) => b.unrespondedCount - a.unrespondedCount);
    },
    enabled: !!user?.id,
    refetchInterval: 60000, // Refresh every minute
  });
}
