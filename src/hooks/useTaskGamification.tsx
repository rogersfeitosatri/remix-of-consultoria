import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface TaskGamification {
  user_id: string;
  total_xp: number;
  level: number;
  current_streak: number;
  longest_streak: number;
  last_completed_date: string | null;
}

export const LEVEL_LABELS: Record<number, { name: string; color: string; next: number | null }> = {
  1: { name: 'Bronze', color: '#b45309', next: 100 },
  2: { name: 'Prata', color: '#64748b', next: 500 },
  3: { name: 'Ouro', color: '#eab308', next: 2000 },
  4: { name: 'Diamante', color: '#06b6d4', next: 5000 },
  5: { name: 'Lendário', color: '#a855f7', next: null },
};

export function useTaskGamification() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['task-gamification', user?.id],
    queryFn: async (): Promise<TaskGamification> => {
      if (!user?.id) throw new Error('not auth');
      const { data } = await (supabase as any)
        .from('task_gamification')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      return (
        data || {
          user_id: user.id,
          total_xp: 0,
          level: 1,
          current_streak: 0,
          longest_streak: 0,
          last_completed_date: null,
        }
      );
    },
    enabled: !!user?.id,
  });
}
