import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type ZnPlanCode = 'monthly' | 'quarterly' | 'semiannual' | 'annual';

export interface PublicZnPlan {
  code: ZnPlanCode;
  label: string;
  price: number;
  duration_months: number;
  is_active: boolean;
}

const SUFFIX: Record<ZnPlanCode, string> = { monthly: '/mês', quarterly: '/trimestre', semiannual: '/semestre', annual: '/ano' };
const INSTALLMENTS: Record<ZnPlanCode, string> = {
  monthly: 'Cartão de crédito',
  quarterly: 'Cartão de crédito · à vista ou 3x R$ 59,90',
  semiannual: 'Cartão de crédito · à vista ou até 6x',
  annual: 'Cartão de crédito · à vista ou até 12x',
};

export function fmtBRL(v: number) {
  return `R$ ${Number(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

/**
 * Lê os planos ativos da assessoria (zn_plans) para exibir preços no wizard
 * público. Leitura anônima liberada por RLS (planos ativos). Retorna um mapa
 * pronto para a UI; quando o banco ainda não respondeu, o consumidor usa seu
 * fallback local.
 */
export function usePublicZnPlans() {
  const query = useQuery({
    queryKey: ['public-zn-plans'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('zn_plans')
        .select('code, name, price, duration_months, is_active')
        .eq('is_active', true);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const byCode: Partial<Record<ZnPlanCode, PublicZnPlan>> = {};
  for (const row of query.data ?? []) {
    const code = row.code as ZnPlanCode;
    if (!['monthly', 'quarterly', 'semiannual', 'annual'].includes(code)) continue;
    byCode[code] = {
      code,
      label: row.name || code,
      price: Number(row.price) || 0,
      duration_months: Number(row.duration_months) || 1,
      is_active: row.is_active !== false,
    };
  }

  // Formata para a UI: { code: { label, price ("R$ x/mês"), priceShort, sub } }
  const info = (code: ZnPlanCode, fallback: { label: string; price: string; sub: string }) => {
    const p = byCode[code];
    if (!p || !p.price) return fallback;
    return {
      label: p.label,
      price: `${fmtBRL(p.price)}${SUFFIX[code]}`,
      priceShort: fmtBRL(p.price),
      sub: INSTALLMENTS[code],
    };
  };

  return { plans: byCode, info, isLoading: query.isLoading };
}
