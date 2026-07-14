// deno-lint-ignore-file no-explicit-any
// Webhook do Asaas — não requer JWT (verify_jwt = false).
// Configure a URL no painel Asaas: /functions/v1/asaas-webhook
// Defina ASAAS_WEBHOOK_TOKEN no Asaas (Header "asaas-access-token") e como secret aqui.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const ASAAS_WEBHOOK_TOKEN = Deno.env.get("ASAAS_WEBHOOK_TOKEN") ?? "";

const METHOD_MAP: Record<string, string> = {
  CREDIT_CARD: "card",
  PIX: "pix",
  BOLETO: "boleto",
  UNDEFINED: "card",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (ASAAS_WEBHOOK_TOKEN) {
      const token = req.headers.get("asaas-access-token") ?? "";
      if (token !== ASAAS_WEBHOOK_TOKEN) {
        return new Response("unauthorized", { status: 401 });
      }
    }

    const payload = await req.json();
    const event = payload?.event as string | undefined;
    const p = payload?.payment;
    if (!event) {
      return new Response(JSON.stringify({ ignored: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Roteamento ZN Assessoria: se o evento pertencer ao fluxo ZN
    // (externalReference "zn:..." OU customer/subscription já registrados em
    // zn_athletes), delega ao webhook ZN. Assim o Asaas pode apontar para uma
    // única URL e ambos os fluxos funcionam.
    const extRef = String(
      p?.externalReference ?? payload?.subscription?.externalReference ?? payload?.externalReference ?? "",
    );
    let isZn = extRef.startsWith("zn:") || event.startsWith("SUBSCRIPTION_");
    if (!isZn && (p?.subscription || p?.customer)) {
      const { data: znMatch } = await supabase
        .from("zn_athletes")
        .select("id")
        .or(
          [
            p?.subscription ? `asaas_subscription_id.eq.${p.subscription}` : null,
            p?.customer ? `asaas_customer_id.eq.${p.customer}` : null,
          ].filter(Boolean).join(","),
        )
        .limit(1)
        .maybeSingle();
      if (znMatch?.id) isZn = true;
    }
    if (isZn) {
      console.log("asaas-webhook: encaminhando evento ZN para zn-asaas-webhook", { event, extRef });
      const { error: fwdErr } = await supabase.functions.invoke("zn-asaas-webhook", { body: payload });
      if (fwdErr) console.error("asaas-webhook: falha ao encaminhar ZN:", fwdErr);
      return new Response(JSON.stringify({ ok: true, forwarded: "zn" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!p) {
      return new Response(JSON.stringify({ ignored: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Localiza o atleta via subscription ou customer
    let clientRow: any = null;
    if (p.subscription) {
      const { data } = await supabase
        .from("clients")
        .select("id, user_id, start_date, end_date")
        .eq("asaas_subscription_id", p.subscription)
        .maybeSingle();
      clientRow = data;
    }
    if (!clientRow && p.customer) {
      const { data } = await supabase
        .from("clients")
        .select("id, user_id, start_date, end_date")
        .eq("asaas_customer_id", p.customer)
        .maybeSingle();
      clientRow = data;
    }
    if (!clientRow) {
      console.warn("asaas-webhook: cliente não localizado", { subscription: p.subscription, customer: p.customer });
      return new Response(JSON.stringify({ ok: true, matched: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      due_date: p.dueDate ?? new Date().toISOString().slice(0, 10),
      status: isPaid ? "paid" : isFailed ? "overdue" : "pending",
      paid_at: isPaid ? (p.paymentDate ?? new Date().toISOString()) : null,
      payment_method: METHOD_MAP[p.billingType] ?? "card",
      notes: `Asaas • ${event}`,
      asaas_payment_id: p.id,
      asaas_invoice_url: p.invoiceUrl ?? null,
      plan_start_date: clientRow.start_date,
      plan_end_date: clientRow.end_date,
    };

    const { error } = await supabase
      .from("payments")
      .upsert(paymentData, { onConflict: "asaas_payment_id" });
    if (error) throw error;

    // Atualiza status da subscription no client
    if (p.subscription) {
      await supabase
        .from("clients")
        .update({
          asaas_subscription_status: isPaid ? "ACTIVE" : isFailed ? "OVERDUE" : "PENDING",
        })
        .eq("asaas_subscription_id", p.subscription);
    }

    return new Response(JSON.stringify({ ok: true, event }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("asaas-webhook error:", err?.message ?? err);
    return new Response(JSON.stringify({ error: err?.message ?? String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
