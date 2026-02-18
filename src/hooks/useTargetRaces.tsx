import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface TargetRace {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export function useTargetRaces() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['target-races', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('target_races')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as TargetRace[];
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreateTargetRace() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from('target_races')
        .insert({ name: name.trim(), user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data as TargetRace;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['target-races'] });
    },
  });
}
