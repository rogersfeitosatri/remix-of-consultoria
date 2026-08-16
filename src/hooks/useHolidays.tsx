import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toHolidaySet, type HolidaySet } from '@/lib/businessDays';

/** Feriados nacionais + feriados próprios do usuário, para cálculo de dias úteis. */
export function useHolidays() {
  return useQuery<HolidaySet>({
    queryKey: ['holidays'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('holidays' as never)
        .select('holiday_date');
      if (error) throw error;
      return toHolidaySet((data as unknown as { holiday_date: string }[]) || []);
    },
    staleTime: 1000 * 60 * 60,
  });
}
