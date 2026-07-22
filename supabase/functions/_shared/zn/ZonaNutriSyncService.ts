// ZonaNutriSyncService — ÚNICO ponto de contato com a API do Zona Nutri.
// Nenhum outro módulo pode conhecer URL, autenticação ou formato do payload.
//
// Fluxo:
//   1) monta payload completo do atleta + assinatura + evento
//   2) grava linha em zn_integration_outbox (idempotente por evento)
//   3) tenta enviar (POST Bearer <ZONA_NUTRI_API_KEY>)
//   4) se falhar, agenda próxima tentativa com backoff exponencial
//
// Retries: 1min, 5min, 15min, 30min, 60min. Após 5 tentativas → "error".
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type ZnSyncEvent =
  | "subscription_created"   // primeira compra
  | "subscription_renewed"   // renovação
  | "plan_changed"           // alteração de plano
  | "subscription_cancelled" // cancelamento
  | "subscription_suspended" // vencido / suspenso
  | "subscription_reactivated"; // reativação

export const RETRY_MINUTES = [1, 5, 15, 30, 60];
export const MAX_ATTEMPTS = RETRY_MINUTES.length;

export interface ZonaNutriPayload {
  evento: ZnSyncEvent;
  athleteId: string;
  nome: string | null;
  email: string;
  telefone: string | null;
  plano: string;               // código do plano (monthly | semiannual | annual)
  planoCodigo: string;         // idem, explícito
  planoLabel: string;          // rótulo PT: Mensal | Semestral | Anual
  duracaoMeses: number | null; // duração do plano em MESES (1 | 6 | 12)
  status: string;
  dataInicio: string | null;   // início do acesso (YYYY-MM-DD)
  dataExpiracao: string | null; // fim do acesso (YYYY-MM-DD) — construir o prazo por AQUI
  // metadados extras (não obrigatórios para o Zona Nutri, mas ajudam auditoria)
  motivoCancelamento?: string | null;
}

// Duração e rótulo por código de plano — para o Zona Nutri montar o prazo sem
// depender de interpretar o código em inglês.
const PLAN_META: Record<string, { months: number; label: string }> = {
  monthly: { months: 1, label: "Mensal" },
  quarterly: { months: 3, label: "Trimestral" },
  semiannual: { months: 6, label: "Semestral" },
  annual: { months: 12, label: "Anual" },
};

function addMonthsIso(startIso: string, months: number): string {
  const d = new Date(startIso + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

export interface QueueInput {
  owner_user_id: string;
  event: ZnSyncEvent;
  athlete: {
    id: string; email: string;
    name: string | null; phone: string | null;
  };
  subscription: {
    id: string; plan_code: string; status: string;
    start_date: string | null; expires_at: string | null;
    cancel_reason?: string | null;
  };
}

function nowIso() { return new Date().toISOString(); }

export class ZonaNutriSyncService {
  private apiUrl = Deno.env.get("ZONA_NUTRI_API_URL") ?? "";
  private apiKey = Deno.env.get("ZONA_NUTRI_API_KEY") ?? "";

  constructor(private supabase: SupabaseClient, private log?: (m: string, extra?: unknown) => void) {}

  private say(msg: string, extra?: unknown) {
    if (this.log) this.log(msg, extra);
    else console.log("[zn-sync]", msg, extra ? JSON.stringify(extra) : "");
  }

  /**
   * Enfileira um evento (idempotente por athlete+event+subscription snapshot)
   * e dispara tentativa imediata. Chamado por qualquer módulo interno.
   */
  async enqueueAndSend(input: QueueInput): Promise<void> {
    const idempotencyKey =
      `${input.event}:${input.athlete.id}:${input.subscription.id}:${input.subscription.expires_at ?? "null"}:${input.subscription.status}`;

    const planCode = input.subscription.plan_code;
    const meta = PLAN_META[planCode] ?? null;
    // Garante a data de expiração: se vier ausente mas houver início + duração,
    // calcula aqui (defensivo) — o prazo de acesso NUNCA deve faltar.
    const expira = input.subscription.expires_at
      ?? (input.subscription.start_date && meta ? addMonthsIso(input.subscription.start_date, meta.months) : null);

    const payload: ZonaNutriPayload = {
      evento: input.event,
      athleteId: input.athlete.id,
      nome: input.athlete.name,
      email: input.athlete.email,
      telefone: input.athlete.phone,
      plano: planCode,
      planoCodigo: planCode,
      planoLabel: meta?.label ?? planCode,
      duracaoMeses: meta?.months ?? null,
      status: input.subscription.status,
      dataInicio: input.subscription.start_date,
      dataExpiracao: expira,
      motivoCancelamento: input.subscription.cancel_reason ?? null,
    };

    // Idempotência via unique index: se já existe, ignoramos silenciosamente.
    const { data: inserted, error: insErr } = await this.supabase
      .from("zn_integration_outbox")
      .insert({
        user_id: input.owner_user_id,
        athlete_id: input.athlete.id,
        subscription_id: input.subscription.id,
        event_type: input.event,
        payload,
        status: "pending",
        idempotency_key: idempotencyKey,
        endpoint: this.apiUrl || null,
        next_attempt_at: nowIso(),
        attempts: 0,
      })
      .select("id")
      .maybeSingle();

    if (insErr) {
      // Colisão de unique => evento já enfileirado
      if (String(insErr.message).match(/duplicate|unique/i)) {
        this.say("Evento já enfileirado (idempotente) — nenhuma ação", { idempotencyKey });
        return;
      }
      this.say("Falha ao enfileirar outbox", { error: insErr.message });
      return;
    }
    if (!inserted) return;

    this.say("Evento enfileirado", { id: inserted.id, event: input.event });

    // Tentativa síncrona imediata (best-effort)
    await this.attemptSend(inserted.id);
  }

  /**
   * Tenta enviar UMA linha da outbox. Atualiza status conforme resultado.
   * Idempotência downstream: Idempotency-Key header = outbox.id.
   */
  async attemptSend(outboxId: string): Promise<void> {
    const { data: row } = await this.supabase
      .from("zn_integration_outbox")
      .select("*")
      .eq("id", outboxId)
      .maybeSingle();
    if (!row) return;
    if (row.status !== "pending") return;

    if (!this.apiUrl || !this.apiKey) {
      // Ausência de credenciais → mantém pendente e adia 1min
      await this.supabase.from("zn_integration_outbox").update({
        last_error: "ZONA_NUTRI_API_URL/ZONA_NUTRI_API_KEY não configurados",
        next_attempt_at: new Date(Date.now() + 60_000).toISOString(),
      }).eq("id", outboxId);
      this.say("Credenciais ausentes — sync adiado", { outboxId });
      return;
    }

    const attempts = (row.attempts ?? 0) + 1;
    const started = Date.now();
    let httpStatus: number | null = null;
    let respBody: unknown = null;
    let errMsg: string | null = null;
    let ok = false;

    try {
      const res = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
          "Idempotency-Key": row.id,
          "X-Event": row.event_type,
        },
        body: JSON.stringify(row.payload),
      });
      httpStatus = res.status;
      const text = await res.text();
      try { respBody = text ? JSON.parse(text) : null; } catch { respBody = text; }
      ok = res.ok;
      if (!ok) errMsg = `HTTP ${res.status}: ${typeof respBody === "string" ? respBody : JSON.stringify(respBody)}`;
    } catch (e) {
      errMsg = (e as Error).message ?? "network_error";
    }
    const duration_ms = Date.now() - started;

    if (ok) {
      await this.supabase.from("zn_integration_outbox").update({
        status: "sent",
        attempts,
        sent_at: nowIso(),
        last_error: null,
        next_attempt_at: null,
        http_status: httpStatus,
        response_body: respBody as any,
        duration_ms,
      }).eq("id", outboxId);
      this.say("Sync enviado ao Zona Nutri", { outboxId, attempts, httpStatus, duration_ms });
      return;
    }

    // Falha → agenda retry ou marca erro permanente
    const isPermanent = attempts >= MAX_ATTEMPTS;
    const nextDelayMin = RETRY_MINUTES[Math.min(attempts, RETRY_MINUTES.length - 1)];
    const patch: Record<string, unknown> = {
      attempts,
      last_error: errMsg,
      http_status: httpStatus,
      response_body: respBody as any,
      duration_ms,
    };
    if (isPermanent) {
      patch.status = "error";
      patch.next_attempt_at = null;
    } else {
      patch.status = "pending";
      patch.next_attempt_at = new Date(Date.now() + nextDelayMin * 60_000).toISOString();
    }
    await this.supabase.from("zn_integration_outbox").update(patch).eq("id", outboxId);
    this.say("Sync falhou", { outboxId, attempts, isPermanent, nextDelayMin, error: errMsg });
  }

  /** Processa até N linhas pendentes cujo next_attempt_at já venceu. */
  async processDueQueue(limit = 25): Promise<{ processed: number }> {
    const { data: rows } = await this.supabase
      .from("zn_integration_outbox")
      .select("id")
      .eq("status", "pending")
      .lte("next_attempt_at", nowIso())
      .order("next_attempt_at", { ascending: true })
      .limit(limit);
    if (!rows?.length) return { processed: 0 };
    for (const r of rows) {
      await this.attemptSend(r.id);
    }
    return { processed: rows.length };
  }
}
