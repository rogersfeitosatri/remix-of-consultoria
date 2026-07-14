// Fonte única dos planos ZN (preço, duração, ciclo Asaas) — lidos da tabela
// zn_plans (editável em Configurações). Mantém defaults como rede de segurança
// caso a leitura falhe ou os preços ainda não tenham sido configurados.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type PlanCode = "monthly" | "semiannual" | "annual";

export interface PlanInfo {
  code: PlanCode;
  label: string;
  price: number;
  duration_months: number;
  cycle: string;      // ciclo Asaas
  installments: number;
  is_active: boolean;
}

const CYCLE: Record<PlanCode, string> = {
  monthly: "MONTHLY",
  semiannual: "SEMIANNUALLY",
  annual: "YEARLY",
};

// Defaults (rede de segurança) — valores atuais em produção.
const DEFAULTS: Record<PlanCode, PlanInfo> = {
  monthly: { code: "monthly", label: "Mensal", price: 69.9, duration_months: 1, cycle: "MONTHLY", installments: 1, is_active: true },
  semiannual: { code: "semiannual", label: "Semestral", price: 299.0, duration_months: 6, cycle: "SEMIANNUALLY", installments: 6, is_active: true },
  annual: { code: "annual", label: "Anual", price: 419.9, duration_months: 12, cycle: "YEARLY", installments: 12, is_active: true },
};

// Carrega os planos do dono (admin). Faz merge com os defaults por segurança.
export async function loadZnPlans(
  supabase: SupabaseClient,
  ownerUserId: string | null,
): Promise<Record<PlanCode, PlanInfo>> {
  const result: Record<PlanCode, PlanInfo> = {
    monthly: { ...DEFAULTS.monthly },
    semiannual: { ...DEFAULTS.semiannual },
    annual: { ...DEFAULTS.annual },
  };
  try {
    let query = supabase.from("zn_plans").select("code, name, duration_months, price, is_active");
    if (ownerUserId) query = query.eq("user_id", ownerUserId);
    const { data } = await query;
    for (const row of (data || []) as any[]) {
      const code = row.code as PlanCode;
      if (!result[code]) continue;
      const price = Number(row.price);
      const dur = Number(row.duration_months) || DEFAULTS[code].duration_months;
      result[code] = {
        code,
        label: row.name || DEFAULTS[code].label,
        // Só usa o preço do banco se for > 0 (evita cobrar R$0 se ainda não configurado).
        price: price > 0 ? price : DEFAULTS[code].price,
        duration_months: dur,
        cycle: CYCLE[code],
        installments: dur,
        is_active: row.is_active !== false,
      };
    }
  } catch (_) { /* usa defaults */ }
  return result;
}

// Conjunto de valores válidos ZN (para o guard multi-tenant do webhook).
export async function znActivePrices(
  supabase: SupabaseClient,
  ownerUserId: string | null,
): Promise<Set<number>> {
  const plans = await loadZnPlans(supabase, ownerUserId);
  const set = new Set<number>();
  for (const p of Object.values(plans)) set.add(Math.round(p.price * 100) / 100);
  // inclui defaults também, por segurança em renovações antigas
  for (const p of Object.values(DEFAULTS)) set.add(Math.round(p.price * 100) / 100);
  return set;
}
