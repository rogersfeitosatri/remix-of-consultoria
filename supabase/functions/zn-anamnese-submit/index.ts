// deno-lint-ignore-file no-explicit-any
// Fluxo ZN Assessoria via anamnese endurance:
// 1) Executa o processamento padrão da anamnese (invoca process-anamnese-submission)
//    para criar/vincular client, athlete_profile e anamnese_response.
// 2) Cria/atualiza zn_athlete com plan_choice + CPF + link para o client.
// 3) Cria customer + subscription no Asaas com externalReference=zn:{athlete_id}.
// 4) Retorna payment_link da 1ª cobrança para o front redirecionar.
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
  form_id: z.string().uuid(),
  respondent_name: z.string().trim().min(3).max(200),
  respondent_email: z.string().trim().email().max(200),
  responses: z.record(z.any()),
  plan_choice: z.enum(["monthly", "semiannual", "annual"]),
  cpf: z.string().trim().min(11).max(20),
  phone: z.string().trim().min(8).max(20).optional().nullable(),
  coupon_code: z.string().trim().max(40).optional().nullable(),
});

function onlyDigits(s: string) {
  return (s ?? "").replace(/\D+/g, "");
}

function addMonthsISO(base: Date, months: number): string {
  const d = new Date(base);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

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

async function resolveOwnerUserId(supabase: any, formUserId: string | null): Promise<string> {
  if (formUserId) return formUserId;
  const envOwner = Deno.env.get("ZN_OWNER_USER_ID");
  if (envOwner) return envOwner;
  const { data } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin")
    .order("user_id", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data?.user_id) throw new Error("Nenhum admin dono configurado");
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
    const emailNorm = data.respondent_email.trim().toLowerCase();
    const cpfDigits = onlyDigits(data.cpf);
    const phoneDigits = data.phone ? onlyDigits(data.phone) : null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) Executa fluxo padrão da anamnese (cria client + athlete_profile + response)
    const { data: procRes, error: procErr } = await supabase.functions.invoke(
      "process-anamnese-submission",
      {
        body: {
          form_id: data.form_id,
          respondent_name: data.respondent_name,
          respondent_email: emailNorm,
          responses: data.responses,
          source: "zn",
        },
      },
    );
    if (procErr) throw new Error(`process-anamnese-submission: ${procErr.message ?? procErr}`);
    if ((procRes as any)?.error) throw new Error(String((procRes as any).error));
    const clientId: string | null = (procRes as any)?.client_id ?? null;

    // Sobrescreve plano legado no client (caso o email já existisse com plano antigo)
    // e limpa gatilhos do fluxo MP para não disparar link do Mercado Pago em reenvios.
    if (clientId) {
      await supabase
        .from("clients")
        .update({
          plan_type: "premium",
          plan_duration: data.plan_choice,
          registration_source: "zn_anamnese",
          selected_plan_id: null,
          onboarding_status: "awaiting_payment",
        })
        .eq("id", clientId);
    }

    // 2) Descobre owner do formulário
    const { data: formRow } = await supabase
      .from("anamnese_forms")
      .select("user_id")
      .eq("id", data.form_id)
      .maybeSingle();
    const ownerUserId = await resolveOwnerUserId(supabase, formRow?.user_id ?? null);

    // Planos vêm da configuração (zn_plans) — fonte única de preço/ciclo.
    const catalog = await loadZnPlans(supabase, ownerUserId);
    const p = catalog[data.plan_choice];
    const plan = { value: p.price, cycle: p.cycle, label: p.label, installments: p.installments };

    // 2.1) Cupom (opcional) — valida e calcula o efeito sobre o plano
    let coupon: any = null;
    let effectiveValue = plan.value;      // valor recorrente da assinatura
    let firstPaymentValue: number | null = null; // desconto só na 1ª cobrança (percent 'first')
    let freeMonths = 0;                   // meses grátis antes da 1ª cobrança
    if (data.coupon_code) {
      const { data: c } = await supabase
        .from("zn_coupons")
        .select("*")
        .eq("user_id", ownerUserId)
        .ilike("code", data.coupon_code.trim())
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      const today = new Date().toISOString().slice(0, 10);
      const valid =
        c &&
        (!c.valid_from || today >= c.valid_from) &&
        (!c.valid_until || today <= c.valid_until) &&
        (c.max_uses == null || Number(c.uses_count) < Number(c.max_uses));
      if (valid) {
        coupon = c;
        if (c.discount_type === "free_months") {
          freeMonths = Math.max(0, Number(c.free_months ?? 0));
        } else {
          // Desconto percentual vale APENAS para o período do contrato (1ª
          // cobrança). As renovações voltam ao valor cheio — assim, se o cupom
          // for desativado depois, nenhuma cobrança futura continua com desconto.
          const pct = Math.min(100, Math.max(0, Number(c.percent_off ?? 0)));
          firstPaymentValue = Math.round(plan.value * (1 - pct / 100) * 100) / 100;
        }
      }
    }

    // Bloqueio: assinatura ativa no mesmo e-mail
    const { data: existing } = await supabase
      .from("zn_athletes")
      .select("id, status")
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

    // 3) Cria/atualiza zn_athlete
    const athletes = new AthleteService(supabase);
    const znAthlete = await athletes.findOrCreate({
      owner_user_id: ownerUserId,
      email: emailNorm,
      name: data.respondent_name,
      phone: phoneDigits,
      cpf_cnpj: cpfDigits,
    });

    await supabase
      .from("zn_athletes")
      .update({
        plan_choice: data.plan_choice,
        status: existing?.status === "lead" ? "pending" : (znAthlete.status ?? "pending"),
        lead_marked_at: null,
        metadata: { ...(znAthlete.metadata ?? {}), consultoria_client_id: clientId },
      })
      .eq("id", znAthlete.id);

    // 4) Customer Asaas
    let customerId = znAthlete.asaas_customer_id as string | null;
    if (!customerId) {
      const customer = await asaas("/customers", {
        method: "POST",
        body: JSON.stringify({
          name: data.respondent_name,
          email: emailNorm,
          mobilePhone: phoneDigits ?? undefined,
          cpfCnpj: cpfDigits,
          externalReference: `zn:${znAthlete.id}`,
        }),
      });
      customerId = customer.id;
      await supabase
        .from("zn_athletes")
        .update({ asaas_customer_id: customerId })
        .eq("id", znAthlete.id);
    }

    // 5) Assinatura Asaas
    // Com cupom de meses grátis, a 1ª cobrança é adiada para depois do período.
    const nextDueStr = freeMonths > 0
      ? addMonthsISO(new Date(), freeMonths)
      : (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); })();
    const subPayload: Record<string, unknown> = {
      customer: customerId,
      billingType: "CREDIT_CARD",
      cycle: plan.cycle,
      value: effectiveValue,
      nextDueDate: nextDueStr,
      description: `ZN Assessoria - Plano ${plan.label}` + (coupon ? ` (cupom ${coupon.code})` : ""),
      externalReference: `zn:${znAthlete.id}`,
    };
    if (plan.installments && plan.installments > 1) {
      subPayload.maxInstallmentCount = plan.installments;
    }
    const subscription = await asaas("/subscriptions", {
      method: "POST",
      body: JSON.stringify(subPayload),
    });

    // 6) 1ª cobrança → invoiceUrl (e, se cupom 'first', ajusta o valor só dela)
    let paymentLink: string | null = null;
    try {
      const payments = await asaas(`/subscriptions/${subscription.id}/payments`);
      const first = payments?.data?.[0] ?? null;
      if (first && firstPaymentValue != null && firstPaymentValue !== plan.value) {
        try {
          const updated = await asaas(`/payments/${first.id}`, {
            method: "POST",
            body: JSON.stringify({ value: firstPaymentValue }),
          });
          paymentLink = updated?.invoiceUrl ?? first.invoiceUrl ?? null;
        } catch (_) {
          paymentLink = first.invoiceUrl ?? null;
        }
      } else {
        paymentLink = first?.invoiceUrl ?? null;
      }
    } catch (_) { /* ignore */ }

    await supabase
      .from("zn_athletes")
      .update({ last_payment_link: paymentLink })
      .eq("id", znAthlete.id);

    // 7) Atribuição do cupom/criador + registro de uso (para ranking)
    if (coupon) {
      const amountOff =
        coupon.discount_type === "percent"
          ? Math.round((plan.value - (firstPaymentValue ?? effectiveValue)) * 100) / 100
          : null;
      await supabase
        .from("zn_athletes")
        .update({
          coupon_id: coupon.id,
          promoter_id: coupon.promoter_id ?? null,
          coupon_code: coupon.code,
        })
        .eq("id", znAthlete.id);

      await supabase.from("zn_coupon_redemptions").insert({
        user_id: ownerUserId,
        coupon_id: coupon.id,
        promoter_id: coupon.promoter_id ?? null,
        athlete_id: znAthlete.id,
        code: coupon.code,
        discount_type: coupon.discount_type,
        amount_off: amountOff,
      });

      await supabase
        .from("zn_coupons")
        .update({ uses_count: Number(coupon.uses_count ?? 0) + 1 })
        .eq("id", coupon.id);
    }

    // 8) Cupom de meses grátis: libera o acesso já no cadastro (período grátis)
    //    e envia o link do Asaas por WhatsApp para o atleta finalizar o
    //    pagamento ao fim do período e continuar com acesso — sem refazer a anamnese.
    if (freeMonths > 0) {
      const freeUntil = addMonthsISO(new Date(), freeMonths);
      // Ativa a assinatura no nosso sistema durante o período grátis.
      const { data: existingSub } = await supabase
        .from("zn_subscriptions")
        .select("id")
        .eq("asaas_subscription_id", subscription.id)
        .maybeSingle();
      if (!existingSub) {
        await supabase.from("zn_subscriptions").insert({
          user_id: ownerUserId,
          athlete_id: znAthlete.id,
          plan_code: data.plan_choice,
          status: "active",
          start_date: new Date().toISOString().slice(0, 10),
          expires_at: freeUntil,
          asaas_customer_id: customerId,
          asaas_subscription_id: subscription.id,
          coupon_id: coupon?.id ?? null,
          promoter_id: coupon?.promoter_id ?? null,
        });
      }
      await supabase.from("zn_athletes").update({ status: "active" }).eq("id", znAthlete.id);

      // Envia o link de pagamento por WhatsApp (não bloqueia o retorno).
      if (phoneDigits && paymentLink) {
        try {
          const [y, m, d] = freeUntil.split("-");
          const venc = `${d}/${m}/${y}`;
          await supabase.functions.invoke("send-whatsapp", {
            body: {
              phone: phoneDigits,
              message:
                `Olá ${data.respondent_name.split(" ")[0]}! 🎉 Seu acesso à ZN Assessoria já está liberado ` +
                `com ${freeMonths === 1 ? "o 1º mês grátis" : `${freeMonths} meses grátis`}.\n\n` +
                `Para continuar após ${venc}, finalize o pagamento por aqui (não precisa refazer a anamnese): ${paymentLink}`,
              context: "zn_free_trial",
            },
          });
        } catch (e) {
          console.warn("zn-anamnese-submit: WhatsApp do período grátis falhou:", (e as Error).message);
        }
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        success: true,
        client_id: clientId,
        athlete_id: znAthlete.id,
        subscription_id: subscription.id,
        payment_link: paymentLink,
        plan: data.plan_choice,
        value: plan.value,
        coupon_applied: coupon ? coupon.code : null,
        charged_value: firstPaymentValue ?? effectiveValue,
        free_months: freeMonths,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("zn-anamnese-submit:", err?.message ?? err);
    return new Response(
      JSON.stringify({ error: err?.message ?? String(err) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
