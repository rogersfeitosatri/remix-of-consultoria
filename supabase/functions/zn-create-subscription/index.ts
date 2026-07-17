// deno-lint-ignore-file no-explicit-any
// Endpoint público que recebe os dados do wizard ZN, cria/atualiza atleta
// pendente e gera a assinatura no Asaas. Retorna o invoiceUrl da 1ª cobrança
// para o front redirecionar o atleta.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "https://esm.sh/zod@3.23.8";
import { AthleteService } from "../_shared/zn/AthleteService.ts";
import { loadZnPlans } from "../_shared/zn/planCatalog.ts";

const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY")!;
const ASAAS_ENV = (Deno.env.get("ASAAS_ENV") ?? "sandbox").toLowerCase();
const ASAAS_BASE =
  ASAAS_ENV === "production"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3";

type PlanCode = "monthly" | "semiannual" | "annual";

const Schema = z.object({
  plan_choice: z.enum(["monthly", "semiannual", "annual"]),
  name: z.string().trim().min(3).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().min(8).max(20),
  cpf: z.string().trim().min(11).max(20),
  body_goal: z.enum(["lose", "maintain", "gain"]),
  has_target_race: z.boolean().default(false),
  target_race: z.string().trim().max(200).optional().nullable(),
  target_race_date: z.string().optional().nullable(), // YYYY-MM-DD
  weight_kg: z.number().min(20).max(400),
  height_cm: z.number().min(80).max(260),
});

async function asaas(path: string, init: RequestInit = {}) {
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      access_token: ASAAS_API_KEY,
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Asaas ${path} [${res.status}]: ${text}`);
  return text ? JSON.parse(text) : {};
}

function onlyDigits(s: string) {
  return (s ?? "").replace(/\D+/g, "");
}

async function resolveOwnerUserId(supabase: any): Promise<string> {
  const envOwner = Deno.env.get("ZN_OWNER_USER_ID");
  if (envOwner) return envOwner;
  const { data } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin")
    .order("user_id", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data?.user_id) throw new Error("ZN_OWNER_USER_ID não configurado e nenhum admin encontrado");
  return data.user_id as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!ASAAS_API_KEY) throw new Error("ASAAS_API_KEY não configurada");

    const body = await req.json();
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "invalid_payload", details: parsed.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const data = parsed.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const ownerUserId = await resolveOwnerUserId(supabase);

    // Planos vêm da configuração (zn_plans) — fonte única de preço/ciclo.
    const catalog = await loadZnPlans(supabase, ownerUserId);
    const pInfo = catalog[data.plan_choice];
    const plan = { value: pInfo.price, cycle: pInfo.cycle, label: pInfo.label, installments: pInfo.installments };

    // Bloqueio de duplicidade: e-mail com assinatura ativa
    const emailNorm = data.email.trim().toLowerCase();
    const { data: existing } = await supabase
      .from("zn_athletes")
      .select("id, status, name")
      .eq("user_id", ownerUserId)
      .eq("email", emailNorm)
      .maybeSingle();

    if (existing && existing.status === "active") {
      return new Response(
        JSON.stringify({
          error: "already_active",
          message: "Já existe uma assinatura ativa para este e-mail. Verifique seu WhatsApp.",
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const cpfDigits = onlyDigits(data.cpf);
    const phoneDigits = onlyDigits(data.phone);

    // Cria/atualiza atleta ZN
    const athletes = new AthleteService(supabase);
    const athlete = await athletes.findOrCreate({
      owner_user_id: ownerUserId,
      email: emailNorm,
      name: data.name,
      phone: phoneDigits,
      cpf_cnpj: cpfDigits,
    });

    await supabase
      .from("zn_athletes")
      .update({
        plan_choice: data.plan_choice,
        body_goal: data.body_goal,
        target_race: data.has_target_race ? (data.target_race ?? null) : null,
        target_race_date: data.has_target_race ? (data.target_race_date ?? null) : null,
        weight_kg: data.weight_kg,
        height_cm: data.height_cm,
        status: existing?.status === "lead" ? "pending" : (athlete.status ?? "pending"),
        lead_marked_at: null,
      })
      .eq("id", athlete.id);

    // 1) Customer no Asaas
    let customerId = athlete.asaas_customer_id as string | null;
    if (!customerId) {
      const customer = await asaas("/customers", {
        method: "POST",
        body: JSON.stringify({
          name: data.name,
          email: emailNorm,
          mobilePhone: phoneDigits,
          cpfCnpj: cpfDigits,
          externalReference: `zn:${athlete.id}`,
        }),
      });
      customerId = customer.id;
      await supabase
        .from("zn_athletes")
        .update({ asaas_customer_id: customerId })
        .eq("id", athlete.id);
    }

    // 2) Assinatura Asaas — externalReference identifica origem ZN
    // Para planos parcelados (semestral/anual), o período atual é cobrado como
    // /payments com installmentCount (até Nx no cartão) e a subscription começa
    // a renovar depois do período pago.
    const isInstallmentPlan = (plan.installments ?? 1) > 1;
    const durationMonths = pInfo.duration_months ?? (data.plan_choice === "semiannual" ? 6 : data.plan_choice === "annual" ? 12 : 1);

    const subNextDue = new Date();
    if (isInstallmentPlan) {
      subNextDue.setMonth(subNextDue.getMonth() + durationMonths);
    } else {
      subNextDue.setDate(subNextDue.getDate() + 1);
    }

    // Assinatura (Subscription) — SOMENTE Cartão de Crédito (sem PIX/Boleto).
    // Enviamos o valor TOTAL da assinatura (não dividido); o parcelamento em até
    // `maxInstallmentCount` (nativo do Asaas) é oferecido no checkout, à vista ou
    // parcelado. A renovação ocorre automaticamente a cada `cycle`.
    const subPayload: Record<string, unknown> = {
      customer: customerId,
      billingType: "CREDIT_CARD", // SOMENTE cartão de crédito (sem PIX/Boleto)
      cycle: plan.cycle,
      value: plan.value, // valor integral da assinatura (ex.: 299,00 no semestral)
      nextDueDate: subNextDue.toISOString().slice(0, 10),
      description: `ZN Assessoria - Plano ${plan.label}`,
      externalReference: `zn:${athlete.id}`,
    };
    // Parcelamento nativo do Asaas nas renovações (à vista ou até Nx no cartão).
    if (isInstallmentPlan) {
      subPayload.maxInstallmentCount = plan.installments;
    }

    const subscription = await asaas("/subscriptions", {
      method: "POST",
      body: JSON.stringify(subPayload),
    });

    // 3) Link de pagamento
    let paymentLink: string | null = null;
    if (isInstallmentPlan) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);
      try {
        const oneTime = await asaas("/payments", {
          method: "POST",
          body: JSON.stringify({
            customer: customerId,
            billingType: "CREDIT_CARD", // SOMENTE cartão (sem PIX/Boleto)
            dueDate: dueDate.toISOString().slice(0, 10),
            description: `ZN Assessoria - Plano ${plan.label} (até ${plan.installments}x no cartão)`,
            externalReference: `zn:${athlete.id}`,
            totalValue: plan.value,
            installmentCount: plan.installments,
          }),
        });
        paymentLink = oneTime?.invoiceUrl ?? oneTime?.payments?.[0]?.invoiceUrl ?? null;
      } catch (e) {
        console.warn("zn-create-subscription: falha ao criar cobrança parcelada:", (e as Error).message);
      }
    }
    if (!paymentLink) {
      try {
        const payments = await asaas(`/subscriptions/${subscription.id}/payments`);
        paymentLink = payments?.data?.[0]?.invoiceUrl ?? null;
      } catch (_) { /* ignore */ }
    }

    await supabase
      .from("zn_athletes")
      .update({ last_payment_link: paymentLink })
      .eq("id", athlete.id);

    return new Response(
      JSON.stringify({
        ok: true,
        athlete_id: athlete.id,
        subscription_id: subscription.id,
        payment_link: paymentLink,
        plan: data.plan_choice,
        value: plan.value,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("zn-create-subscription:", err?.message ?? err);
    return new Response(
      JSON.stringify({ error: err?.message ?? String(err) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
