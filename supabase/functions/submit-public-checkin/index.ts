// ETAPA 6A — E. PUBLIC TOKEN-SCOPED.
//
// Única porta de entrada para respostas públicas de check-in.
// O browser anônimo NÃO insere mais diretamente em `checkin_responses`.
//
// Autorização = DISPATCH (o convite real enviado ao atleta):
//   token do dispatch (preferencial) ou, para links legados sem token,
//   telefone do atleta + último dispatch enviado dentro da janela.
// Tudo que o servidor consegue resolver (client_id, form_id, form_version_id,
// schedule) é derivado do dispatch — nunca do payload.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  publicCorsHeaders,
  logSecurityEvent,
  hitRateLimit,
  callerIp,
} from "../_shared/authGuard.ts";

const DEFAULT_WINDOW_HOURS = 36;
const MAX_TEXT = 5000;

type Body = {
  formId?: string;
  dispatchToken?: string;
  clientId?: string;
  phone?: string;
  responses?: Record<string, { answer?: unknown; comment?: unknown }>;
};

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...publicCorsHeaders, "Content-Type": "application/json" },
  });
}

/** Mensagens públicas nunca revelam existência de usuário, tenant ou erro de SQL. */
function reject(code: string, _status = 403): Response {
  const messages: Record<string, string> = {
    INVALID_LINK: "Este link de check-in não é válido. Peça um novo ao seu nutricionista.",
    EXPIRED: "O prazo para responder este check-in expirou.",
    ALREADY_SUBMITTED: "Este check-in já foi respondido.",
    NOT_ELIGIBLE: "Não foi possível registrar este check-in no momento.",
    RATE_LIMITED: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
    INVALID_PAYLOAD: "Dados inválidos.",
  };
  // status 200 de propósito: o cliente precisa LER o código para exibir a mensagem certa.
  return json({ error: code, message: messages[code] ?? messages.NOT_ELIGIBLE }, 200);
}

function normalizePhoneToE164(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  while (digits.startsWith("0")) digits = digits.slice(1);
  if (!digits.startsWith("55")) digits = `55${digits}`;
  return `+${digits}`;
}

function isUuid(v: unknown): v is string {
  return typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

/** Sanitiza um valor de resposta: só primitivos e arrays de primitivos. */
function sanitizeAnswer(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return value.slice(0, MAX_TEXT);
  if (Array.isArray(value)) {
    return value.slice(0, 100).map((v) =>
      typeof v === "string" ? v.slice(0, MAX_TEXT) : (typeof v === "number" || typeof v === "boolean") ? v : null
    );
  }
  return null; // objetos arbitrários são descartados (anti mass-assignment)
}

async function allowedQuestionIds(
  supabase: SupabaseClient,
  formId: string,
  formVersionId: string | null,
): Promise<Set<string>> {
  const ids = new Set<string>();
  if (formVersionId) {
    const { data } = await supabase
      .from("checkin_form_version_questions")
      .select("id, source_question_id")
      .eq("version_id", formVersionId);
    for (const q of (data ?? []) as { id: string; source_question_id: string | null }[]) {
      ids.add(q.source_question_id ?? q.id);
      ids.add(q.id);
    }
  }
  const { data: base } = await supabase
    .from("checkin_questions")
    .select("id")
    .eq("form_id", formId);
  for (const q of (base ?? []) as { id: string }[]) ids.add(q.id);
  return ids;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: publicCorsHeaders });

  const ip = callerIp(req);
  try {
    // 25. Rate limit por IP (fail-open apenas se o limitador estiver indisponível)
    if (!(await hitRateLimit("public_checkin_submit", ip, 15, 3600))) {
      await logSecurityEvent({
        eventType: "public_checkin_rejected",
        fn: "submit-public-checkin",
        metadata: { reason: "rate_limited" },
      });
      return reject("RATE_LIMITED", 429);
    }

    const body = (await req.json()) as Body;
    if (!body?.responses || typeof body.responses !== "object" || Array.isArray(body.responses)) {
      return reject("INVALID_PAYLOAD", 400);
    }
    if (!body.phone || typeof body.phone !== "string") return reject("INVALID_PAYLOAD", 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const normalizedPhone = normalizePhoneToE164(body.phone);

    // ---- 15. O DISPATCH AUTORIZA A RESPOSTA ----
    type Dispatch = {
      id: string; client_id: string; checkin_form_id: string;
      form_version_id: string | null; sent_at: string | null; status: string;
    };
    let dispatch: Dispatch | null = null;

    if (typeof body.dispatchToken === "string" && body.dispatchToken.length >= 8) {
      const { data } = await supabase
        .from("checkin_dispatches")
        .select("id, client_id, checkin_form_id, form_version_id, sent_at, status")
        .eq("dispatch_token", body.dispatchToken)
        .maybeSingle();
      dispatch = (data as Dispatch | null) ?? null;
      if (!dispatch) {
        await logSecurityEvent({
          eventType: "public_checkin_rejected",
          fn: "submit-public-checkin",
          metadata: { reason: "invalid_token" },
        });
        return reject("INVALID_LINK", 403);
      }
    } else {
      // 17. COMPATIBILIDADE — links legados (sem token): contexto resolvido
      // server-side pelo telefone + último dispatch enviado.
      const { data: client } = await supabase
        .from("clients")
        .select("id, phone")
        .eq("is_active", true)
        .eq("is_frozen", false)
        .is("archived_at", null)
        .eq("phone", normalizedPhone)
        .maybeSingle();

      let legacyClientId = client?.id ?? null;
      if (!legacyClientId) {
        // telefones gravados em formatos diferentes: varredura normalizada
        const { data: candidates } = await supabase
          .from("clients")
          .select("id, phone")
          .not("phone", "is", null)
          .eq("is_active", true)
          .eq("is_frozen", false)
          .is("archived_at", null)
          .limit(2000);
        const match = (candidates ?? []).find(
          (c: { id: string; phone: string | null }) =>
            c.phone && normalizePhoneToE164(c.phone) === normalizedPhone,
        );
        legacyClientId = match?.id ?? null;
      }
      if (!legacyClientId) return reject("INVALID_LINK", 403);

      let q = supabase
        .from("checkin_dispatches")
        .select("id, client_id, checkin_form_id, form_version_id, sent_at, status")
        .eq("client_id", legacyClientId)
        .eq("status", "sent")
        .not("sent_at", "is", null)
        .order("sent_at", { ascending: false })
        .limit(1);
      if (isUuid(body.formId)) q = q.eq("checkin_form_id", body.formId);
      const { data } = await q.maybeSingle();
      dispatch = (data as Dispatch | null) ?? null;
      if (!dispatch) return reject("INVALID_LINK", 403);
    }

    // 20. contexto SEMPRE derivado do dispatch
    const clientId = dispatch.client_id;
    const formId = dispatch.checkin_form_id;
    const formVersionId = dispatch.form_version_id;

    // Segundo fator: o telefone informado precisa bater com o do atleta do dispatch.
    const { data: client } = await supabase
      .from("clients")
      .select("id, phone, is_active, is_frozen, archived_at, checkin_response_window_hours, user_id")
      .eq("id", clientId)
      .maybeSingle();

    if (!client || !client.phone || normalizePhoneToE164(client.phone) !== normalizedPhone) {
      await logSecurityEvent({
        eventType: "public_checkin_rejected",
        fn: "submit-public-checkin",
        clientId,
        entityId: dispatch.id,
        metadata: { reason: "phone_mismatch" },
      });
      return reject("INVALID_LINK", 403);
    }

    // Estado operacional do atleta
    if (!client.is_active || client.is_frozen || client.archived_at) {
      await logSecurityEvent({
        eventType: "public_checkin_rejected",
        fn: "submit-public-checkin",
        clientId,
        entityId: dispatch.id,
        metadata: { reason: "client_not_operational" },
      });
      return reject("NOT_ELIGIBLE", 403);
    }

    // Dispatch precisa ter sido efetivamente enviado e estar dentro da janela
    if (dispatch.status !== "sent" || !dispatch.sent_at) return reject("INVALID_LINK", 403);
    const windowHours = client.checkin_response_window_hours ?? DEFAULT_WINDOW_HOURS;
    const hours = (Date.now() - new Date(dispatch.sent_at).getTime()) / 36e5;
    if (hours > windowHours) return reject("EXPIRED", 403);

    // 22. REPLAY — uma resposta por ocorrência de dispatch
    const { data: existing } = await supabase
      .from("checkin_responses")
      .select("id")
      .eq("client_id", clientId)
      .eq("form_id", formId)
      .gte("submitted_at", dispatch.sent_at)
      .limit(1);
    if (existing && existing.length > 0) return reject("ALREADY_SUBMITTED", 409);

    // 21. MASS ASSIGNMENT — só perguntas conhecidas, só answer/comment sanitizados
    const allowed = await allowedQuestionIds(supabase, formId, formVersionId);
    const clean: Record<string, { answer: unknown; comment: string | null }> = {};
    for (const [qid, raw] of Object.entries(body.responses)) {
      if (!isUuid(qid) || !allowed.has(qid)) continue;
      const comment = raw && typeof (raw as any).comment === "string"
        ? String((raw as any).comment).slice(0, MAX_TEXT)
        : null;
      clean[qid] = { answer: sanitizeAnswer((raw as any)?.answer), comment };
    }
    if (Object.keys(clean).length === 0) return reject("INVALID_PAYLOAD", 400);

    const { data: inserted, error: insertError } = await supabase
      .from("checkin_responses")
      .insert({
        form_id: formId,
        client_id: clientId,
        responses: clean,
        dispatch_id: dispatch.id,
        ...(formVersionId ? { form_version_id: formVersionId } : {}),
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[submit-public-checkin] insert failed", insertError.message);
      return json({ error: "INTERNAL", message: "Não foi possível enviar agora. Tente novamente." }, 500);
    }

    await logSecurityEvent({
      eventType: "public_checkin_accepted",
      fn: "submit-public-checkin",
      clientId,
      entityId: inserted.id,
      metadata: { dispatch_id: dispatch.id, form_version_id: formVersionId },
    });

    // Notificação do admin (fire-and-forget, autenticada internamente)
    try {
      await supabase.functions.invoke("notify-checkin-response", {
        headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
        body: { clientId, formId, responses: clean },
      });
    } catch (_e) { /* notificação nunca bloqueia o envio */ }

    return json({ success: true });
  } catch (error) {
    console.error("[submit-public-checkin] error", error);
    return json({ error: "INTERNAL", message: "Não foi possível enviar agora. Tente novamente." }, 500);
  }
});
