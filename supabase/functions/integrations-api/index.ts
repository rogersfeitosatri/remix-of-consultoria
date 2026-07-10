// deno-lint-ignore-file no-explicit-any
// Integrations API — servidor central para consumidores externos (Zona Nutri
// e futuros). Camadas:
//   Controller (aqui)  ← autentica, valida DTO, chama service, formata resposta
//   Service            ← toda a regra de negócio
//   DTO / Validator    ← _shared/integrations/dtos.ts
//   Auth / Logger      ← _shared/integrations/{auth,logger}.ts
//
// Rotas expostas (sob /functions/v1/integrations-api):
//   POST /subscription/cancel
//   GET  /subscription/:athleteId
//   POST /subscription/change-plan
//   POST /subscription/reactivate
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { authenticate } from "../_shared/integrations/auth.ts";
import { logApiCall } from "../_shared/integrations/logger.ts";
import {
  validateCancel,
  validateChangePlan,
  validateReactivate,
} from "../_shared/integrations/dtos.ts";
import {
  HttpError,
  SubscriptionIntegrationService,
} from "../_shared/integrations/SubscriptionIntegrationService.ts";

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const started = Date.now();
  const url = new URL(req.url);

  // Path após /functions/v1/integrations-api
  const parts = url.pathname
    .replace(/^\/functions\/v1\/integrations-api/, "")
    .replace(/^\/+/, "")
    .split("/")
    .filter(Boolean);

  const endpoint = "/" + parts.join("/");
  const method = req.method.toUpperCase();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ---- Autenticação (obrigatória em todas as rotas) ----
  const auth = await authenticate(req, supabase);
  if (!auth.ok) {
    const body = { success: false, error: "unauthorized", reason: auth.reason };
    await logApiCall(supabase, {
      endpoint, method,
      source_system: null,
      status_code: 401, success: false,
      error_message: auth.reason,
      duration_ms: Date.now() - started,
      response_payload: body,
    });
    return json(401, body);
  }

  // Lê corpo se houver
  let payload: any = null;
  if (method !== "GET" && req.headers.get("content-length") !== "0") {
    try { payload = await req.json(); } catch { payload = null; }
  }

  const svc = new SubscriptionIntegrationService(supabase);
  let status = 200;
  let responseBody: any = null;
  let athleteId: string | null = null;
  let subscriptionId: string | null = null;
  let errorMessage: string | null = null;

  try {
    // ------- ROUTING -------
    if (parts[0] === "subscription" && parts[1] === "cancel" && method === "POST") {
      const v = validateCancel(payload);
      if (!v.ok) { status = 400; responseBody = { success: false, error: "validation_error", details: v.errors }; }
      else {
        athleteId = v.data.athleteId;
        const r = await svc.cancel(v.data.athleteId, v.data.motivoCancelamento);
        subscriptionId = r.subscriptionId;
        responseBody = { success: true, status: "cancelled", ...r };
      }
    } else if (parts[0] === "subscription" && parts[1] === "change-plan" && method === "POST") {
      const v = validateChangePlan(payload);
      if (!v.ok) { status = 400; responseBody = { success: false, error: "validation_error", details: v.errors }; }
      else {
        athleteId = v.data.athleteId;
        const r = await svc.changePlan(v.data.athleteId, v.data.novoPlano);
        subscriptionId = r.subscriptionId;
        responseBody = { success: true, ...r };
      }
    } else if (parts[0] === "subscription" && parts[1] === "reactivate" && method === "POST") {
      const v = validateReactivate(payload);
      if (!v.ok) { status = 400; responseBody = { success: false, error: "validation_error", details: v.errors }; }
      else {
        athleteId = v.data.athleteId;
        const r = await svc.reactivate(v.data.athleteId);
        subscriptionId = r.subscriptionId;
        responseBody = { success: true, ...r };
      }
    } else if (parts[0] === "subscription" && parts[1] && method === "GET") {
      athleteId = parts[1];
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRe.test(athleteId)) {
        status = 400;
        responseBody = { success: false, error: "validation_error", details: [{ field: "athleteId", message: "UUID inválido" }] };
      } else {
        const r = await svc.get(athleteId);
        subscriptionId = r.subscriptionId;
        responseBody = { success: true, ...r };
      }
    } else {
      status = 404;
      responseBody = { success: false, error: "not_found", message: `Rota não encontrada: ${method} ${endpoint}` };
    }
  } catch (err: any) {
    if (err instanceof HttpError) {
      status = err.status;
      responseBody = { success: false, error: err.code, message: err.message };
      errorMessage = err.message;
    } else {
      console.error("[integrations-api] erro inesperado:", err?.message ?? err);
      status = 500;
      responseBody = { success: false, error: "internal_error", message: err?.message ?? String(err) };
      errorMessage = err?.message ?? String(err);
    }
  }

  await logApiCall(supabase, {
    endpoint, method,
    source_system: auth.source_system,
    status_code: status,
    success: status < 400,
    error_message: errorMessage,
    duration_ms: Date.now() - started,
    request_payload: method === "GET" ? null : payload,
    response_payload: responseBody,
    athlete_id: athleteId,
    subscription_id: subscriptionId,
  });

  return json(status, responseBody);
});
