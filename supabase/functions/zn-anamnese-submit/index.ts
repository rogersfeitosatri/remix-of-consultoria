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

const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY")!;
const ASAAS_ENV = (Deno.env.get("ASAAS_ENV") ?? "sandbox").toLowerCase();
const ASAAS_BASE =
  ASAAS_ENV === "production"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3";

type PlanCode = "monthly" | "semiannual" | "annual";

const PLANS: Record<PlanCode, { cycle: string; value: number; installments?: number; label: string }> = {
  monthly:    { cycle: "MONTHLY",       value: 69.9,  installments: 1,  label: "Mensal" },
  semiannual: { cycle: "SEMIANNUALLY",  value: 299.0, installments: 6,  label: "Semestral" },
  annual:     { cycle: "YEARLY",        value: 419.9, installments: 12, label: "Anual" },
};

const Schema = z.object({
  form_id: z.string().uuid(),
  respondent_name: z.string().trim().min(3).max(200),
  respondent_email: z.string().trim().email().max(200),
  responses: z.record(z.any()),
  plan_choice: z.enum(["monthly", "semiannual", "annual"]),
  cpf: z.string().trim().min(11).max(20),
  phone: z.string().trim().min(8).max(20).optional().nullable(),
});

function onlyDigits(s: string) {
  return (s ?? "").replace(/\D+/g, "");
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
    const plan = PLANS[data.plan_choice];
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
    const nextDue = new Date();
    nextDue.setDate(nextDue.getDate() + 1);
    const subPayload: Record<string, unknown> = {
      customer: customerId,
      billingType: "UNDEFINED",
      cycle: plan.cycle,
      value: plan.value,
      nextDueDate: nextDue.toISOString().slice(0, 10),
      description: `ZN Assessoria - Plano ${plan.label}`,
      externalReference: `zn:${znAthlete.id}`,
    };
    if (plan.installments && plan.installments > 1) {
      subPayload.maxInstallmentCount = plan.installments;
    }
    const subscription = await asaas("/subscriptions", {
      method: "POST",
      body: JSON.stringify(subPayload),
    });

    // 6) 1ª cobrança → invoiceUrl
    let paymentLink: string | null = null;
    try {
      const payments = await asaas(`/subscriptions/${subscription.id}/payments`);
      paymentLink = payments?.data?.[0]?.invoiceUrl ?? null;
    } catch (_) { /* ignore */ }

    await supabase
      .from("zn_athletes")
      .update({ last_payment_link: paymentLink })
      .eq("id", znAthlete.id);

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
