// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY")!;
const ASAAS_ENV = (Deno.env.get("ASAAS_ENV") ?? "sandbox").toLowerCase();
const ASAAS_BASE =
  ASAAS_ENV === "production"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3";

const CYCLE_MAP: Record<string, string> = {
  monthly: "MONTHLY",
  quarterly: "QUARTERLY",
  semiannual: "SEMIANNUALLY",
  annual: "YEARLY",
};

async function asaas(path: string, init: RequestInit = {}) {
  const res = await fetch(`${ASAAS_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      access_token: ASAAS_API_KEY,
      ...(init.headers ?? {}),
    },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Asaas ${path} [${res.status}]: ${body}`);
  return body ? JSON.parse(body) : {};
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!ASAAS_API_KEY) throw new Error("ASAAS_API_KEY não configurada");

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabaseUser.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { client_id, cpf_cnpj } = await req.json();
    if (!client_id) throw new Error("client_id obrigatório");

    const { data: client, error: clientErr } = await supabase
      .from("clients")
      .select("*")
      .eq("id", client_id)
      .single();
    if (clientErr || !client) throw new Error("Atleta não encontrado");

    const cycle = CYCLE_MAP[client.plan_duration];
    if (!cycle) {
      throw new Error(
        `Plano "${client.plan_duration}" não suportado para recorrência automática (use monthly/quarterly/semiannual/annual)`,
      );
    }
    if (!client.monthly_value || client.monthly_value <= 0) {
      throw new Error("Atleta sem valor mensal cadastrado");
    }

    // 1) Cria ou reusa customer no Asaas
    let customerId = client.asaas_customer_id as string | null;
    if (!customerId) {
      const customer = await asaas("/customers", {
        method: "POST",
        body: JSON.stringify({
          name: client.name,
          email: client.email ?? undefined,
          mobilePhone: client.phone ?? undefined,
          cpfCnpj: cpf_cnpj ?? undefined,
          externalReference: client.id,
        }),
      });
      customerId = customer.id;
    }

    // 2) Cria assinatura (cartão de crédito)
    const nextDue = new Date();
    nextDue.setDate(nextDue.getDate() + 1); // primeira cobrança amanhã
    const subscription = await asaas("/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        customer: customerId,
        billingType: "CREDIT_CARD",
        cycle,
        value: Number(client.monthly_value),
        nextDueDate: nextDue.toISOString().slice(0, 10),
        description: `Plano ${client.plan_type} - ${client.name}`,
        externalReference: client.id,
      }),
    });

    // 3) Salva vínculo no client
    await supabase
      .from("clients")
      .update({
        asaas_customer_id: customerId,
        asaas_subscription_id: subscription.id,
        asaas_subscription_status: subscription.status ?? "ACTIVE",
      })
      .eq("id", client.id);

    // 4) Retorna link de pagamento (invoiceUrl da primeira cobrança gerada)
    let paymentLink: string | null = null;
    try {
      const payments = await asaas(
        `/subscriptions/${subscription.id}/payments`,
      );
      paymentLink = payments?.data?.[0]?.invoiceUrl ?? null;
    } catch (_) {
      /* ignore */
    }

    return new Response(
      JSON.stringify({
        customer_id: customerId,
        subscription_id: subscription.id,
        status: subscription.status,
        payment_link: paymentLink,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("asaas-create-subscription:", err?.message ?? err);
    return new Response(
      JSON.stringify({ error: err?.message ?? String(err) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
