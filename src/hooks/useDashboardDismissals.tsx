import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

// Persistência dos itens do dashboard marcados como "Concluído".
// Fonte da verdade: tabela dashboard_dismissals (por usuário). Enquanto a
// tabela não existir (migration ainda não aplicada) ou offline, cai no
// localStorage — então continua funcionando e vira permanente após o deploy.
const LS_KEY = 'dashboard-dismissed-v3';

function readLS(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
}
function writeLS(map: Record<string, number>) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(map)); } catch { /* noop */ }
}

export function useDashboardDismissals() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: dbKeys } = useQuery({
    queryKey: ['dashboard-dismissals', user?.id],
    enabled: !!user?.id,
    staleTime: 30_000,
    retry: false, // tabela pode não existir ainda → não fica re-tentando
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await (supabase as any)
        .from('dashboard_dismissals')
        .select('item_key')
        .eq('user_id', user!.id);
      if (error) throw error;
      return (data || []).map((r: any) => r.item_key as string);
    },
  });

  // Conjunto efetivo = banco (quando disponível) + localStorage (fallback/cache).
  const set = new Set<string>([...(dbKeys || []), ...Object.keys(readLS())]);
  const isDismissed = (key: string) => set.has(key);

  const dismiss = async (key: string) => {
    // Otimista: localStorage + cache do React Query já escondem na hora.
    const ls = readLS();
    ls[key] = Date.now();
    writeLS(ls);
    qc.setQueryData<string[]>(['dashboard-dismissals', user?.id], (prev = []) =>
      prev.includes(key) ? prev : [...prev, key],
    );
    // Persiste no banco (permanente e cross-device). Falha silenciosa mantém o LS.
    if (user?.id) {
      try {
        await (supabase as any)
          .from('dashboard_dismissals')
          .upsert({ user_id: user.id, item_key: key }, { onConflict: 'user_id,item_key' });
      } catch { /* mantém localStorage */ }
    }
  };

  return { isDismissed, dismiss };
}
