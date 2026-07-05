import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Peso de referência do atleta para cálculos de g/kg no plano alimentar:
 * 1) Peso do check-in mais recente que tem o campo "peso" respondido
 * 2) Fallback: peso registrado na última anamnese (current_weight)
 * Retorna null se nenhum dos dois existir.
 */
export function useAthleteWeight(clientId?: string | null) {
  return useQuery({
    queryKey: ['athlete-weight', clientId],
    enabled: !!clientId,
    staleTime: 60_000,
    queryFn: async (): Promise<{ weightKg: number | null; source: 'checkin' | 'anamnese' | null; date?: string }> => {
      if (!clientId) return { weightKg: null, source: null };

      // 1) Latest check-in with peso
      try {
        const { data } = await supabase
          .from('checkin_responses')
          .select('responses, submitted_at')
          .eq('client_id', clientId)
          .order('submitted_at', { ascending: false })
          .limit(20);
        for (const row of data || []) {
          const raw = (row as any)?.responses?.peso;
          if (raw != null && raw !== '') {
            const w = parseFloat(String(raw).replace(',', '.'));
            if (!isNaN(w) && w > 20 && w < 300) {
              return { weightKg: w, source: 'checkin', date: (row as any).submitted_at };
            }
          }
        }
      } catch { /* fallthrough */ }

      // 2) Fallback: anamnese
      try {
        const { data } = await (supabase as any)
          .from('anamnese_responses')
          .select('current_weight, submitted_at')
          .eq('client_id', clientId)
          .order('submitted_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        const w = data?.current_weight ? parseFloat(String(data.current_weight).replace(',', '.')) : null;
        if (w && !isNaN(w) && w > 20 && w < 300) {
          return { weightKg: w, source: 'anamnese', date: data?.submitted_at };
        }
      } catch { /* fallthrough */ }

      return { weightKg: null, source: null };
    },
  });
}
