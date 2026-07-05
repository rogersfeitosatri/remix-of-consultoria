import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface DailyLog {
  water_ml: number;
  completed_meals: string[];
}

/**
 * Registro diário do atleta (refeições concluídas + água). Otimista e resiliente:
 * se a tabela ainda não existir no banco, mantém o estado apenas na sessão.
 * readOnly (admin visualizando) desabilita as gravações.
 */
export function useAthleteDailyLog(clientId?: string, readOnly = false) {
  const qc = useQueryClient();
  const date = todayISO();
  const key = ['athlete-daily-log', clientId, date];

  const query = useQuery({
    queryKey: key,
    enabled: !!clientId,
    staleTime: 30_000,
    queryFn: async (): Promise<DailyLog> => {
      const { data, error } = await (supabase as any)
        .from('athlete_daily_logs')
        .select('water_ml, completed_meals')
        .eq('client_id', clientId)
        .eq('log_date', date)
        .maybeSingle();
      if (error) throw error;
      return {
        water_ml: data?.water_ml ?? 0,
        completed_meals: (data?.completed_meals as string[]) ?? [],
      };
    },
  });

  const current: DailyLog = query.data ?? { water_ml: 0, completed_meals: [] };

  const persist = async (next: DailyLog) => {
    qc.setQueryData(key, next); // otimista
    if (readOnly || !clientId) return;
    const { error } = await (supabase as any)
      .from('athlete_daily_logs')
      .upsert(
        { client_id: clientId, log_date: date, water_ml: next.water_ml, completed_meals: next.completed_meals, updated_at: new Date().toISOString() },
        { onConflict: 'client_id,log_date' },
      );
    if (error) console.warn('[dailyLog] persist falhou (mantendo estado local):', error.message);
  };

  const toggleMeal = (mealKey: string) => {
    if (readOnly) return;
    const set = new Set(current.completed_meals);
    if (set.has(mealKey)) set.delete(mealKey); else set.add(mealKey);
    persist({ ...current, completed_meals: [...set] });
  };

  const addWater = (ml: number) => {
    if (readOnly) return;
    persist({ ...current, water_ml: Math.max(0, current.water_ml + ml) });
  };

  return {
    waterMl: current.water_ml,
    completedMeals: current.completed_meals,
    isMealDone: (k: string) => current.completed_meals.includes(k),
    toggleMeal,
    addWater,
    isLoading: query.isLoading,
  };
}
