// PaymentOrchestrator — centraliza TODA a regra de negócio disparada por um
// evento do Asaas. O webhook é apenas transporte; aqui vive o fluxo:
//   1) validar payload
//   2) enriquecer com API do Asaas quando falta dado
//   3) localizar/criar atleta
//   4) criar/atualizar assinatura, calcular validade
//   5) registrar pagamento
//   6) delegar sincronização externa (ExternalSyncService)
//
// Cada passo emite um log estruturado usando o mesmo prefixo, de modo que a
// aba "Eventos webhook" e os logs da função contem a história completa.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { AthleteService, extractCustomerFromEvent } from "./AthleteService.ts";
import { SubscriptionService } from "./SubscriptionService.ts";
import { PaymentService } from "./PaymentService.ts";
import { ExternalSyncService } from "./ExternalSyncService.ts";
import { mapAsaasCycleToPlan, type AsaasEventPayload, type ZnPlanCode } from "./types.ts";
import { znActivePrices } from "./planCatalog.ts";

const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY") ?? "";
const ASAAS_BASE =
  (Deno.env.get("ASAAS_ENV") ?? "sandbox").toLowerCase() === "production"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3";

const PAID_EVENTS = new Set(["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"]);

export interface OrchestratorResult {
  status: "processed" | "skipped";
  reason?: string;
  athlete_id?: string;
  subscription_id?: string | null;
  payment_id?: string | null;
}

export class PaymentOrchestrator {
  private log: (msg: string, extra?: any) => void;
  private athletes: AthleteService;
  private subs: SubscriptionService;
  private payments: PaymentService;
  private sync: ExternalSyncService;

  constructor(private supabase: SupabaseClient, private eventId: string | null) {
    const tag = eventId ? `zn[${eventId}]` : "zn";
    this.log = (msg, extra) => {
      if (extra !== undefined) console.log(tag, msg, JSON.stringify(extra));
      else console.log(tag, msg);
    };
    this.athletes = new AthleteService(supabase);
    this.subs = new SubscriptionService(supabase);
    this.payments = new PaymentService(supabase);
    this.sync = new ExternalSyncService(supabase, this.log);
  }

  async handle(payload: AsaasEventPayload, ownerUserId: string): Promise<OrchestratorResult> {
    const eventType = (payload?.event ?? "unknown").toUpperCase();
    this.log("[1/9] Webhook recebido", { event: eventType });

    const p = payload.payment;
    if (!p) {
      this.log("[skip] Payload sem objeto payment");
      return { status: "skipped", reason: "no_payment" };
    }
    this.log("[2/9] Pagamento validado no payload", { paymentId: p.id, value: p.value });

    // Enriquecimento (fica no orquestrador, não no webhook)
    const customerInfo = extractCustomerFromEvent(payload);
    let customerData = payload.customer ?? null;
    if (!customerData?.email && customerInfo.asaas_customer_id) {
      customerData = await this.fetchAsaasCustomer(customerInfo.asaas_customer_id);
    }
    let subscriptionData = payload.subscription ?? null;
    if (!subscriptionData && p.subscription) {
      subscriptionData = await this.fetchAsaasSubscription(p.subscription);
    }

    // Guard multi-tenant: só aceita eventos originados no funil ZN.
    // externalReference "zn:{athlete_id}" é setado por zn-create-subscription.
    // Os valores válidos vêm da configuração (zn_plans) + defaults.
    const ZN_VALUES = await znActivePrices(this.supabase, ownerUserId);
    const extRef = (subscriptionData?.externalReference ?? (p as any).externalReference ?? "").toString();
    const isZnRef = extRef.startsWith("zn:");
    const value = Number(p.value ?? subscriptionData?.value ?? 0);
    const isZnValue = ZN_VALUES.has(Math.round(value * 100) / 100);
    if (!isZnRef && !isZnValue) {
      this.log("[skip] Evento fora do escopo ZN (externalReference/valor não batem)", {
        externalReference: extRef || null,
        value,
      });
      return { status: "skipped", reason: "not_zn_subscription" };
    }


    const email = customerData?.email ?? null;
    if (!email) {
      this.log("[skip] Customer sem e-mail — não é possível cadastrar atleta");
      return { status: "skipped", reason: "no_customer_email" };
    }

    // 3) Atleta
    const existingBefore = await this.supabase
      .from("zn_athletes")
      .select("id")
      .eq("user_id", ownerUserId)
      .eq("email", email.toLowerCase())
      .maybeSingle();

    const athlete = await this.athletes.findOrCreate({
      owner_user_id: ownerUserId,
      email,
      name: customerData?.name ?? null,
      phone: customerData?.mobilePhone ?? customerData?.phone ?? null,
      cpf_cnpj: customerData?.cpfCnpj ?? null,
      asaas_customer_id: customerInfo.asaas_customer_id,
    });

    if (existingBefore.data?.id) {
      this.log("[3/9] Cliente localizado", { athlete_id: athlete.id, email: athlete.email });
    } else {
      this.log("[3/9] Cadastro criado", { athlete_id: athlete.id, email: athlete.email });
    }

    // 4) Plano
    const plan: ZnPlanCode | null = mapAsaasCycleToPlan(subscriptionData?.cycle);
    if (plan) {
      this.log("[4/9] Plano identificado", { plan, cycle: subscriptionData?.cycle });
    } else {
      this.log("[4/9] Plano NÃO identificado (subscription sem cycle)", { cycle: subscriptionData?.cycle });
    }

    // 5) Assinatura
    const isPaid = PAID_EVENTS.has(eventType);
    const reference_date = p.paymentDate ? new Date(p.paymentDate) : new Date();

    let subscription: any = null;
    let isFirstPurchase = false;
    if (plan && isPaid) {
      const existingSub = await this.subs.findByAsaasIds({
        asaas_subscription_id: p.subscription,
        asaas_customer_id: customerInfo.asaas_customer_id,
        athlete_id: athlete.id,
      });
      isFirstPurchase = !existingSub;

      subscription = await this.subs.upsertFromPayment({
        owner_user_id: ownerUserId,
        athlete_id: athlete.id,
        plan,
        asaas_customer_id: customerInfo.asaas_customer_id,
        asaas_subscription_id: p.subscription ?? null,
        reference_date,
      });

      if (existingSub) {
        this.log("[5/9] Assinatura renovada", {
          subscription_id: subscription.id,
          status: subscription.status,
        });
      } else {
        this.log("[5/9] Assinatura criada (primeira compra)", {
          subscription_id: subscription.id,
          status: subscription.status,
        });
      }
      this.log("[6/9] Validade calculada", {
        start_date: subscription.start_date,
        expires_at: subscription.expires_at,
      });

      await this.athletes.markActive(athlete.id);
    } else if (plan) {
      // Evento não-pago (overdue/refunded/deleted): apenas localiza para vincular
      subscription = await this.subs.findByAsaasIds({
        asaas_subscription_id: p.subscription,
        asaas_customer_id: customerInfo.asaas_customer_id,
        athlete_id: athlete.id,
      });
      this.log("[5/9] Evento não-pago — assinatura apenas localizada", {
        subscription_id: subscription?.id ?? null,
      });
    }

    // Transições de status derivadas do evento (não bloqueia acesso, só registra)
    let statusEvent: string | null = null;
    if (subscription) {
      if (eventType === "PAYMENT_OVERDUE") {
        await this.subs.setStatus(subscription.id, "overdue");
        subscription.status = "overdue";
        statusEvent = "subscription.suspended";
        this.log("[status] Assinatura marcada como overdue");
      } else if (eventType === "SUBSCRIPTION_DELETED") {
        await this.subs.setStatus(subscription.id, "cancelled", "asaas_subscription_deleted");
        subscription.status = "cancelled";
        subscription.cancel_reason = "asaas_subscription_deleted";
        statusEvent = "subscription.cancelled";
        this.log("[status] Assinatura cancelada (acesso permanece — regra atual)");
      } else if (eventType === "PAYMENT_REFUNDED") {
        await this.subs.setStatus(subscription.id, "suspended", "payment_refunded");
        subscription.status = "suspended";
        statusEvent = "subscription.suspended";
        this.log("[status] Assinatura marcada como suspended (refund)");
      }
    }

    // 7) Pagamento sempre registrado
    const payment = await this.payments.upsertFromAsaas({
      owner_user_id: ownerUserId,
      athlete_id: athlete.id,
      subscription_id: subscription?.id ?? null,
      event_type: payload.event ?? "unknown",
      payment: p,
      raw_event: payload,
    });
    this.log("[7/9] Pagamento registrado", {
      payment_id: payment?.id,
      status: payment?.status,
      amount: payment?.amount,
    });

    if (subscription && payment) {
      await this.supabase
        .from("zn_subscriptions")
        .update({ last_payment_id: payment.id })
        .eq("id", subscription.id);
    }

    // 8) Sincronização Zona Nutri — ÚNICO ponto de saída externa
    if (subscription && (isPaid || statusEvent)) {
      const syncEvent = statusEvent
        ? statusEvent
        : isFirstPurchase
          ? "subscription.activated"
          : "subscription.renewed";
      await this.sync.syncAthlete({
        owner_user_id: ownerUserId,
        event: syncEvent,
        athlete: {
          id: athlete.id,
          email: athlete.email,
          name: athlete.name ?? null,
          phone: athlete.phone ?? null,
          cpf_cnpj: athlete.cpf_cnpj ?? null,
        },
        subscription: {
          id: subscription.id,
          plan_code: subscription.plan_code,
          status: subscription.status,
          start_date: subscription.start_date,
          expires_at: subscription.expires_at,
          asaas_customer_id: subscription.asaas_customer_id,
          asaas_subscription_id: subscription.asaas_subscription_id,
          cancel_reason: subscription.cancel_reason ?? null,
        },
      });
      this.log("[8/9] Sync Zona Nutri disparada", { event: syncEvent });

      // WhatsApp de boas-vindas apenas na primeira compra bem-sucedida.
      // ZN athletes NÃO existem em public.clients, então não podemos usar
      // send-whatsapp (que exige clientId). Enviamos direto para o ZAPI e
      // logamos em whatsapp_message_logs com client_id=null.
      if (isFirstPurchase && isPaid && athlete.phone) {
        try {
          // Buscar credenciais retornadas pelo Zona Nutri no sync anterior
          const { data: outboxRow } = await this.supabase
            .from("zn_integration_outbox")
            .select("response_body, status")
            .eq("athlete_id", athlete.id)
            .eq("subscription_id", subscription.id)
            .eq("event_type", "subscription_created")
            .eq("status", "sent")
            .order("sent_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          const resp = (outboxRow?.response_body ?? {}) as Record<string, any>;
          const login = typeof resp.login === "string" ? resp.login : null;
          const senha = typeof resp.senha_temporaria === "string" ? resp.senha_temporaria : null;

          await this.sendZnWelcomeWhatsapp({
            ownerUserId,
            athlete,
            planCode: subscription.plan_code,
            expiresAt: subscription.expires_at,
            login,
            senhaTemporaria: senha,
          });
          this.log("[whatsapp] Mensagem de boas-vindas enviada", { hasCredentials: !!(login && senha) });
        } catch (e) {
          this.log("[whatsapp] Falha ao enviar boas-vindas (não bloqueia)", { error: (e as Error).message });
        }
      }
    } else {
      this.log("[8/9] Sync Zona Nutri não disparada (evento não-pago e sem transição relevante)");
    }

    this.log("[9/9] Fluxo finalizado com sucesso");

    return {
      status: "processed",
      athlete_id: athlete.id,
      subscription_id: subscription?.id ?? null,
      payment_id: payment?.id ?? null,
    };
  }

  private async fetchAsaasSubscription(subId: string) {
    if (!ASAAS_API_KEY || !subId) return null;
    try {
      const res = await fetch(`${ASAAS_BASE}/subscriptions/${subId}`, {
        headers: { access_token: ASAAS_API_KEY },
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  private async fetchAsaasCustomer(customerId: string) {
    if (!ASAAS_API_KEY || !customerId) return null;
    try {
      const res = await fetch(`${ASAAS_BASE}/customers/${customerId}`, {
        headers: { access_token: ASAAS_API_KEY },
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  /**
   * Envia boas-vindas ZN direto no ZAPI (ZN athletes não estão em public.clients).
   * Loga tentativa em whatsapp_message_logs com client_id=null e metadata.zn_athlete_id.
   */
  private async sendZnWelcomeWhatsapp(input: {
    ownerUserId: string;
    athlete: { id: string; name: string | null; phone: string | null; email: string };
    planCode: string;
    expiresAt: string | null;
  }): Promise<void> {
    const zapiInstanceId = Deno.env.get("ZAPI_INSTANCE_ID");
    const zapiToken = Deno.env.get("ZAPI_TOKEN");
    const zapiClientToken = Deno.env.get("ZAPI_CLIENT_TOKEN") ?? "";
    if (!zapiInstanceId || !zapiToken) throw new Error("ZAPI credentials not configured");

    // Normalize phone (E.164 BR, 12-13 digits starting with 55)
    let digits = String(input.athlete.phone ?? "").replace(/\D/g, "");
    while (digits.startsWith("0")) digits = digits.substring(1);
    if (digits.length >= 14 && digits.startsWith("5555")) digits = digits.substring(2);
    if (!digits.startsWith("55")) digits = "55" + digits;
    if (digits.length !== 12 && digits.length !== 13) {
      throw new Error(`Telefone inválido: "${input.athlete.phone}" → ${digits.length} dígitos`);
    }

    const message =
      `Olá ${input.athlete.name ?? ""}! Seu acesso à ZN Assessoria foi ativado ✅\n` +
      `Plano: ${input.planCode}${input.expiresAt ? ` • válido até ${input.expiresAt}` : ""}.\n` +
      `Em instantes você receberá seu login e senha do app Zona Nutri.`;

    const zapiUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-text`;
    const res = await fetch(zapiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Client-Token": zapiClientToken },
      body: JSON.stringify({ phone: digits, message }),
    });
    const zapiResult = await res.json().catch(() => ({}));

    await this.supabase.from("whatsapp_message_logs").insert({
      user_id: input.ownerUserId,
      client_id: null,
      message_type: "zn_welcome",
      template_key: "zn_welcome",
      to_phone: digits,
      status: res.ok ? "sent" : "failed",
      error_message: res.ok ? null : JSON.stringify(zapiResult),
      payload_preview: message.substring(0, 500),
      metadata: {
        zn_athlete_id: input.athlete.id,
        zn_athlete_email: input.athlete.email,
        plan_code: input.planCode,
        zapi_response: zapiResult,
      },
    });

    if (!res.ok) throw new Error(`ZAPI error: ${JSON.stringify(zapiResult)}`);
  }
}
