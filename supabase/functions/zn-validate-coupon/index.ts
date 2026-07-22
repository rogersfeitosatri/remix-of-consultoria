// deno-lint-ignore-file no-explicit-any
// Endpoint público: valida um cupom ZN e devolve o efeito (desconto % ou meses
// grátis) já calculado sobre o plano escolhido. Não aplica nada — só valida.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { loadZnPlans } from "../_shared/zn/planCatalog.ts";

type PlanCode = "monthly" | "quarterly" | "semiannual" | "annual";
const VALID_PLANS = new Set<PlanCode>(["monthly", "quarterly", "semiannual", "annual"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const code = String(body.code ?? "").trim();
    const plan = String(body.plan_choice ?? "quarterly") as PlanCode;
    if (!code) return json({ valid: false, message: "Informe um cupom." });
    if (!VALID_PLANS.has(plan)) return json({ valid: false, message: "Plano inválido." });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Preços/rótulos vêm da configuração (zn_plans).
    const catalog = await loadZnPlans(supabase, null);
    const PLAN_VALUE: Record<PlanCode, number> = {
      monthly: catalog.monthly.price, quarterly: catalog.quarterly.price, semiannual: catalog.semiannual.price, annual: catalog.annual.price,
    };
    const PLAN_LABEL: Record<PlanCode, string> = {
      monthly: catalog.monthly.label, quarterly: catalog.quarterly.label, semiannual: catalog.semiannual.label, annual: catalog.annual.label,
    };

    const { data: coupon } = await supabase
      .from("zn_coupons")
      .select("*")
      .ilike("code", code)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (!coupon) return json({ valid: false, message: "Cupom inválido ou inativo." });

    const today = new Date().toISOString().slice(0, 10);
    if (coupon.valid_from && today < coupon.valid_from) {
      return json({ valid: false, message: "Cupom ainda não está válido." });
    }
    if (coupon.valid_until && today > coupon.valid_until) {
      return json({ valid: false, message: "Cupom expirado." });
    }
    if (coupon.max_uses != null && Number(coupon.uses_count) >= Number(coupon.max_uses)) {
      return json({ valid: false, message: "Cupom esgotado." });
    }

    const baseValue = PLAN_VALUE[plan];
    if (coupon.discount_type === "free_months") {
      const months = Number(coupon.free_months ?? 0);
      return json({
        valid: true,
        code: coupon.code,
        discount_type: "free_months",
        free_months: months,
        base_value: baseValue,
        final_value: baseValue, // valor cheio após o período grátis
        label: months === 1
          ? "1º mês grátis — cobrança a partir do 2º mês"
          : `${months} meses grátis — cobrança depois`,
        message: `Cupom aplicado: ${months === 1 ? "1º mês grátis" : `${months} meses grátis`}.`,
      });
    }

    // percent — vale apenas para o período do contrato (1ª cobrança)
    const pct = Number(coupon.percent_off ?? 0);
    const discountValue = Math.round(baseValue * (pct / 100) * 100) / 100;
    const finalValue = Math.round((baseValue - discountValue) * 100) / 100;
    return json({
      valid: true,
      code: coupon.code,
      discount_type: "percent",
      percent_off: pct,
      base_value: baseValue,
      discount_value: discountValue,
      final_value: finalValue,
      label: `${pct}% de desconto no plano ${PLAN_LABEL[plan]} (período do contrato)`,
      message: `Cupom aplicado: ${pct}% de desconto no período do contrato.`,
    });
  } catch (err: any) {
    console.error("zn-validate-coupon:", err?.message ?? err);
    return json({ valid: false, message: "Erro ao validar cupom." }, 200);
  }
});
