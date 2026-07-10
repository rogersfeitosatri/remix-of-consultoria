// deno-lint-ignore-file no-explicit-any
// Webhook Asaas dedicado ao módulo ZN Assessoria.
// Roteador FINO: valida token, persiste evento cru, delega aos serviços.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { AthleteService, extractCustomerFromEvent } from "../_shared/zn/AthleteService.ts";
import { SubscriptionService } from "../_shared/zn/SubscriptionService.ts";
import { PaymentService } from "../_shared/zn/PaymentService.ts";
import { IntegrationService } from "../_shared/zn/IntegrationService.ts";
import { mapAsaasCycleToPlan, type AsaasEventPayload, type ZnPlanCode } from "../_shared/zn/types.ts";

const ZN_WEBHOOK_TOKEN = Deno.env.get("ZN_ASAAS_WEBHOOK_TOKEN") ?? "";
const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY") ?? "";
const ASAAS_BASE =
  (Deno.env.get("ASAAS_ENV") ?? "sandbox").toLowerCase() === "production"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3";

/**
 * Owner (admin) que "possui" o módulo ZN Assessoria.
 * O Asaas não envia esse dado — definimos por env (ZN_OWNER_USER_ID).
 * Se ausente, usa o primeiro admin do sistema.
 */
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

async function fetchAsaasSubscription(subId: string) {
  if (!ASAAS_API_KEY || !subId) return null;
  try {
    const res = await fetch(`${ASAAS_BASE}/subscriptions/${subId}`, {
      headers: { access_token: ASAAS_API_KEY },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (_) {
    return null;
  }
}

async function fetchAsaasCustomer(customerId: string) {
  if (!ASAAS_API_KEY || !customerId) return null;
  try {
    const res = await fetch(`${ASAAS_BASE}/customers/${customerId}`, {
      headers: { access_token: ASAAS_API_KEY },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (_) {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // 1) Autenticação do webhook
  if (ZN_WEBHOOK_TOKEN) {
    const token = req.headers.get("asaas-access-token") ?? "";
    if (token !== ZN_WEBHOOK_TOKEN) {
      return new Response("unauthorized", { status: 401, headers: corsHeaders });
    }
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let payload: AsaasEventPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const eventType = payload?.event ?? "unknown";
  const asaasEventId = payload?.id ?? null;

  // 2) Persiste evento cru (idempotência via asaas_event_id UNIQUE)
  let eventRowId: string | null = null;
  try {
    const { data: upserted, error } = await supabase
      .from("zn_webhook_events")
      .upsert(
        {
          asaas_event_id: asaasEventId,
          event_type: eventType,
          payload,
          status: "received",
        },
        { onConflict: "asaas_event_id", ignoreDuplicates: false },
      )
      .select("id, status")
      .single();
    if (error) throw error;
    eventRowId = upserted.id;
    // Se já foi processado, retorna 200 sem reprocessar
    if (upserted.status === "processed") {
      return new Response(JSON.stringify({ ok: true, duplicate: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err: any) {
    console.error("zn-webhook: falha ao registrar evento cru", err?.message);
  }

  // 3) Roteamento fino → delegação para serviços
  try {
    const ownerUserId = await resolveOwnerUserId(supabase);
    const athleteSvc = new AthleteService(supabase);
    const subSvc = new SubscriptionService(supabase);
    const paySvc = new PaymentService(supabase);
    const integrationSvc = new IntegrationService(supabase);

    const p = payload.payment;
    if (!p) {
      await markProcessed(supabase, eventRowId, "skipped", "no payment in payload");
      return jsonOk({ skipped: true, reason: "no_payment" });
    }

    // Enriquece com customer + subscription do Asaas quando faltar dado
    const customerInfo = extractCustomerFromEvent(payload);
    let customerData = payload.customer ?? null;
    if (!customerData?.email && customerInfo.asaas_customer_id) {
      customerData = await fetchAsaasCustomer(customerInfo.asaas_customer_id);
    }
    let subscriptionData = payload.subscription ?? null;
    if (!subscriptionData && p.subscription) {
      subscriptionData = await fetchAsaasSubscription(p.subscription);
    }

    const email = customerData?.email ?? null;
    if (!email) {
      await markProcessed(supabase, eventRowId, "skipped", "customer sem e-mail");
      return jsonOk({ skipped: true, reason: "no_customer_email" });
    }

    const plan: ZnPlanCode | null = mapAsaasCycleToPlan(subscriptionData?.cycle);

    // 3.1) Atleta
    const athlete = await athleteSvc.findOrCreate({
      owner_user_id: ownerUserId,
      email,
      name: customerData?.name ?? null,
      phone: customerData?.mobilePhone ?? customerData?.phone ?? null,
      cpf_cnpj: customerData?.cpfCnpj ?? null,
      asaas_customer_id: customerInfo.asaas_customer_id,
    });

    // 3.2) Assinatura
    const eventUpper = eventType.toUpperCase();
    const isPaid = eventUpper === "PAYMENT_CONFIRMED" || eventUpper === "PAYMENT_RECEIVED";

    let subscription = null;
    if (plan) {
      if (isPaid) {
        subscription = await subSvc.upsertFromPayment({
          owner_user_id: ownerUserId,
          athlete_id: athlete.id,
          plan,
          asaas_customer_id: customerInfo.asaas_customer_id,
          asaas_subscription_id: p.subscription ?? null,
          reference_date: p.paymentDate ? new Date(p.paymentDate) : new Date(),
        });
        await athleteSvc.markActive(athlete.id);
      } else {
        // Localiza assinatura existente para vincular pagamento
        subscription = await subSvc.findByAsaasIds({
          asaas_subscription_id: p.subscription,
          asaas_customer_id: customerInfo.asaas_customer_id,
          athlete_id: athlete.id,
        });
      }
    }

    // Status derivados
    if (subscription) {
      if (eventUpper === "PAYMENT_OVERDUE") {
        await subSvc.setStatus(subscription.id, "overdue");
      } else if (eventUpper === "SUBSCRIPTION_DELETED") {
        await subSvc.setStatus(subscription.id, "cancelled", "asaas_subscription_deleted");
      } else if (eventUpper === "PAYMENT_REFUNDED") {
        await subSvc.setStatus(subscription.id, "suspended", "payment_refunded");
      }
    }

    // 3.3) Pagamento (sempre registra)
    const payment = await paySvc.upsertFromAsaas({
      owner_user_id: ownerUserId,
      athlete_id: athlete.id,
      subscription_id: subscription?.id ?? null,
      event_type: eventType,
      payment: p,
      raw_event: payload,
    });

    // Amarra last_payment_id
    if (subscription && payment) {
      await supabase
        .from("zn_subscriptions")
        .update({ last_payment_id: payment.id })
        .eq("id", subscription.id);
    }

    // 3.4) Outbox — integração futura Zona Nutri (não envia agora)
    if (isPaid && subscription) {
      await integrationSvc.enqueue({
        owner_user_id: ownerUserId,
        athlete_id: athlete.id,
        subscription_id: subscription.id,
        event_type: "subscription.activated",
        payload: {
          athlete: { id: athlete.id, email: athlete.email, name: athlete.name },
          subscription: {
            id: subscription.id,
            plan: subscription.plan_code,
            status: subscription.status,
            start_date: subscription.start_date,
            expires_at: subscription.expires_at,
          },
          event: eventType,
        },
      });
    }

    await markProcessed(supabase, eventRowId, "processed", null);
    return jsonOk({ ok: true, event: eventType, athlete_id: athlete.id, subscription_id: subscription?.id ?? null });
  } catch (err: any) {
    console.error("zn-asaas-webhook error:", err?.message ?? err);
    await markProcessed(supabase, eventRowId, "failed", err?.message ?? String(err));
    return new Response(JSON.stringify({ error: err?.message ?? String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function jsonOk(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function markProcessed(
  supabase: any,
  id: string | null,
  status: "processed" | "failed" | "skipped",
  error: string | null,
) {
  if (!id) return;
  await supabase
    .from("zn_webhook_events")
    .update({
      status,
      error,
      processed_at: new Date().toISOString(),
      attempts: (undefined as any),
    })
    .eq("id", id);
  // incrementa attempts em query separada (Supabase JS não expõe expressão SQL simples aqui)
  await supabase.rpc("noop_increment_zn_event_attempts", { p_id: id }).catch(() => {});
}
