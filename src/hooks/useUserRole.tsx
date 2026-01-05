import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type AppRole = 'admin' | 'athlete';

interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export function useUserRole() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['user_role', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data as UserRole | null;
    },
    enabled: !!user,
  });

  return {
    ...query,
    role: query.data?.role ?? null,
    isAdmin: query.data?.role === 'admin',
    isAthlete: query.data?.role === 'athlete',
  };
}

// Hook to get the client data for the current athlete user
export function useAthleteClient() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['athlete_client', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('athlete_user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

// Hook to get checkin responses for a specific client
export function useCheckinResponses(clientId: string | undefined) {
  return useQuery({
    queryKey: ['checkin_responses', clientId],
    queryFn: async () => {
      if (!clientId) return [];

      const { data, error } = await supabase
        .from('checkin_responses')
        .select(`
          *,
          checkin_forms (title)
        `)
        .eq('client_id', clientId)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });
}
