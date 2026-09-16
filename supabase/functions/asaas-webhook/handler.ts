// deno-lint-ignore-file no-explicit-any
// Webhook do Asaas — não requer JWT (verify_jwt = false).
// Configure a URL no painel Asaas: /functions/v1/asaas-webhook
// Defina ASAAS_WEBHOOK_TOKEN no Asaas (Header "asaas-access-token") e como secret aqui.
//
// O handler recebe as dependências para ser testável fora do Deno: banco,
// fetch e ambiente. index.ts o serve com as dependências reais.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { vigenciaMetanoia } from "../_shared/metanoia.ts";
import { enviarConviteDeAgendamento } from "../_shared/conviteDeAgendamento.ts";

const METHOD_MAP: Record<string, string> = {
  CREDIT_CARD: "card",
  PIX: "pix",
  BOLETO: "boleto",
  UNDEFINED: "card",
};

export interface DepsWebhook {
  db: () => any;
  fetch: typeof fetch;
  env: (key: string) => string | undefined;
  agora: () => Date;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function diaLocal(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function depsReais(): DepsWebhook {
  return {
    db: () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!),
    fetch,
    env: (key) => Deno.env.get(key),
    agora: () => new Date(),
  };
}

const CLIENT_FIELDS = "id, user_id, name, phone, start_date, end_date, registration_source, onboarding_status, is_active";

export async function handleAsaasWebhook(req: Request, deps: DepsWebhook = depsReais()): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const webhookToken = deps.env("ASAAS_WEBHOOK_TOKEN") ?? "";
    if (webhookToken) {
      const token = req.headers.get("asaas-access-token") ?? "";
      if (token !== webhookToken) return new Response("unauthorized", { status: 401 });
    }

    const payload = await req.json();
    const event = payload?.event as string | undefined;
    const p = payload?.payment;
    if (!event) return json({ ignored: true });

    const supabase = deps.db();

    // Roteamento ZN Assessoria: se o evento pertencer ao fluxo ZN
    // (externalReference "zn:..." OU customer/subscription já registrados em
    // zn_athletes), delega ao webhook ZN. Assim o Asaas pode apontar para uma
    // única URL e ambos os fluxos funcionam.
    const extRef = String(p?.externalReference ?? payload?.subscription?.externalReference ?? payload?.externalReference ?? "");
    let isZn = extRef.startsWith("zn:") || event.startsWith("SUBSCRIPTION_");
    if (!isZn && (p?.subscription || p?.customer)) {
      const { data: znMatch } = await supabase
        .from("zn_athletes")
        .select("id")
        .or([
          p?.subscription ? `asaas_subscription_id.eq.${p.subscription}` : null,
          p?.customer ? `asaas_customer_id.eq.${p.customer}` : null,
        ].filter(Boolean).join(","))
        .limit(1)
        .maybeSingle();
      if (znMatch?.id) isZn = true;
    }
    if (isZn) {
      console.log("asaas-webhook: encaminhando evento ZN para zn-asaas-webhook", { event, extRef });
      const { error: fwdErr } = await supabase.functions.invoke("zn-asaas-webhook", {
        body: payload,
        headers: webhookToken ? { "asaas-access-token": webhookToken } : {},
      });
      if (fwdErr) console.error("asaas-webhook: falha ao encaminhar ZN:", fwdErr);
      return json({ ok: true, forwarded: "zn", error: fwdErr?.message ?? null });
    }

    if (!p) return json({ ignored: true });

    // Localiza o atleta: assinatura, cliente, referência externa (id do cadastro,
    // como o Metanóia grava) ou o link de pagamento que gerou a cobrança.
    let clientRow: any = null;
    const buscar = async (coluna: string, valor: string) => {
      const { data } = await supabase.from("clients").select(CLIENT_FIELDS).eq(coluna, valor).maybeSingle();
      return data ?? null;
    };
    if (p.subscription) clientRow = await buscar("asaas_subscription_id", p.subscription);
    if (!clientRow && p.customer) clientRow = await buscar("asaas_customer_id", p.customer);
    if (!clientRow && UUID.test(extRef)) clientRow = await buscar("id", extRef);
    if (!clientRow && p.paymentLink) clientRow = await buscar("asaas_payment_link_id", p.paymentLink);
    if (!clientRow) {
      console.warn("asaas-webhook: cliente não localizado", { subscription: p.subscription, customer: p.customer, extRef, paymentLink: p.paymentLink });
      return json({ ok: true, matched: false });
    }

    const isPaid = event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED";
    const isFailed =
      event === "PAYMENT_OVERDUE" ||
      event === "PAYMENT_REFUNDED" ||
      event === "PAYMENT_CHARGEBACK_REQUESTED" ||
      event === "PAYMENT_DELETED";

    // Upsert pelo asaas_payment_id (UNIQUE) — evita duplicidade
    const paymentData = {
      user_id: clientRow.user_id,
      client_id: clientRow.id,
      amount: Number(p.value ?? 0),
      due_date: p.dueDate ?? diaLocal(deps.agora()),
      status: isPaid ? "paid" : isFailed ? "overdue" : "pending",
      paid_at: isPaid ? (p.paymentDate ?? deps.agora().toISOString()) : null,
      payment_method: METHOD_MAP[p.billingType] ?? "card",
      notes: `Asaas • ${event}`,
      asaas_payment_id: p.id,
      asaas_invoice_url: p.invoiceUrl ?? null,
      plan_start_date: clientRow.start_date,
      plan_end_date: clientRow.end_date,
    };
    const { error } = await supabase.from("payments").upsert(paymentData, { onConflict: "asaas_payment_id" });
    if (error) throw error;

    // Atualiza status da subscription no client
    if (p.subscription) {
      await supabase
        .from("clients")
        .update({ asaas_subscription_status: isPaid ? "ACTIVE" : isFailed ? "OVERDUE" : "PENDING" })
        .eq("asaas_subscription_id", p.subscription);
    }

    // Metanóia: o pagamento confirmado liga o atleta, fixa as 12 semanas e
    // manda o convite para agendar a primeira consulta. Uma vez só: a segunda
    // parcela e os reenvios do Asaas encontram onboarding_status = paid.
    let metanoia: Record<string, unknown> | null = null;
    if (isPaid && clientRow.registration_source === "metanoia" && clientRow.onboarding_status !== "paid") {
      const hoje = diaLocal(deps.agora());
      const vigencia = vigenciaMetanoia(hoje);
      const { error: ativarErr } = await supabase
        .from("clients")
        .update({
          is_active: true,
          onboarding_status: "paid",
          athlete_status: "active",
          start_date: vigencia.start_date,
          end_date: vigencia.end_date,
          checkin_start_date: vigencia.start_date,
        })
        .eq("id", clientRow.id)
        .neq("onboarding_status", "paid");
      if (ativarErr) throw ativarErr;
      const convite = await enviarConviteDeAgendamento(
        supabase,
        { id: clientRow.id, user_id: clientRow.user_id, name: clientRow.name, phone: clientRow.phone },
        { fetch: deps.fetch, env: deps.env, agora: deps.agora },
        "metanoia_payment",
      );
      metanoia = { activated: true, invite: convite.ok ? "sent" : convite.reason, ...vigencia };
      if (!convite.ok) console.warn("asaas-webhook: convite de agendamento não enviado", { client: clientRow.id, reason: convite.reason });
    }

    return json({ ok: true, event, metanoia });
  } catch (err: any) {
    console.error("asaas-webhook error:", err?.message ?? err);
    return json({ error: err?.message ?? String(err) }, 500);
  }
}
