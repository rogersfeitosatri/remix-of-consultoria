// deno-lint-ignore-file no-explicit-any
// Webhook Asaas ZN — ROTEADOR FINO.
// Responsabilidades APENAS: autenticar, persistir evento cru, encaminhar ao
// PaymentOrchestrator, marcar o resultado. Toda regra vive nos Services.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { PaymentOrchestrator } from "../_shared/zn/PaymentOrchestrator.ts";
import type { AsaasEventPayload } from "../_shared/zn/types.ts";

// Mesmo token do Asaas já cadastrado pelo admin. Se vazio, aceita sem checar
// (útil apenas em dev). Em produção, o secret DEVE existir.
const WEBHOOK_TOKEN = Deno.env.get("ASAAS_WEBHOOK_TOKEN") ?? "";

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

  // 1) Auth
  if (WEBHOOK_TOKEN) {
    const token = req.headers.get("asaas-access-token") ?? "";
    if (token !== WEBHOOK_TOKEN) {
      console.warn("zn-asaas-webhook: token inválido");
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
    if (upserted.status === "processed") {
      console.log(`zn[${eventRowId}] evento duplicado — ignorado`);
      return json({ ok: true, duplicate: true });
    }
  } catch (err: any) {
    console.error("zn-webhook: falha ao registrar evento cru", err?.message);
  }

  // 3) Encaminha para o orquestrador — toda regra vive lá
  try {
    const ownerUserId = await resolveOwnerUserId(supabase);
    const orchestrator = new PaymentOrchestrator(supabase, eventRowId);
    const result = await orchestrator.handle(payload, ownerUserId);

    await markProcessed(
      supabase,
      eventRowId,
      result.status === "skipped" ? "skipped" : "processed",
      result.reason ?? null,
    );

    return json({
      ok: true,
      event: eventType,
      status: result.status,
      athlete_id: result.athlete_id ?? null,
      subscription_id: result.subscription_id ?? null,
    });
  } catch (err: any) {
    console.error(`zn[${eventRowId}] erro no fluxo:`, err?.message ?? err);
    await markProcessed(supabase, eventRowId, "failed", err?.message ?? String(err));
    return new Response(JSON.stringify({ error: err?.message ?? String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function json(body: Record<string, unknown>) {
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
    .update({ status, error, processed_at: new Date().toISOString() })
    .eq("id", id);
}
