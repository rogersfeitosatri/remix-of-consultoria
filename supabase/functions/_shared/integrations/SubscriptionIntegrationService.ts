// SubscriptionIntegrationService — TODA a regra de negócio dos endpoints da
// API pública vive aqui. Controllers (edge functions) apenas validam entrada,
// chamam o service e formatam a resposta.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { asaasRequest, PLAN_TO_CYCLE } from "./asaas.ts";
import type { ZnPlan } from "./dtos.ts";

const PLAN_MONTHS: Record<ZnPlan, number> = {
  monthly: 1,
  semiannual: 6,
  annual: 12,
};

export class SubscriptionIntegrationService {
  constructor(private supabase: SupabaseClient) {}

  private async loadAthleteAndSubscription(athleteId: string) {
    const { data: athlete } = await this.supabase
      .from("zn_athletes")
      .select("*")
      .eq("id", athleteId)
      .maybeSingle();
    if (!athlete) throw new HttpError(404, "athlete_not_found", "Atleta não encontrado");

    const { data: subscription } = await this.supabase
      .from("zn_subscriptions")
      .select("*")
      .eq("athlete_id", athleteId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return { athlete, subscription };
  }

  // --------- GET /subscription/:athleteId ---------
  async get(athleteId: string) {
    const { athlete, subscription } = await this.loadAthleteAndSubscription(athleteId);
    if (!subscription) throw new HttpError(404, "subscription_not_found", "Assinatura não encontrada");

    // Próxima cobrança: busca no Asaas se disponível
    let nextChargeDate: string | null = null;
    if (subscription.asaas_subscription_id) {
      try {
        const sub = await asaasRequest<{ nextDueDate?: string }>(
          `/subscriptions/${subscription.asaas_subscription_id}`,
        );
        nextChargeDate = sub.nextDueDate ?? null;
      } catch {
        nextChargeDate = null;
      }
    }

    const now = new Date();
    const expiresAt = subscription.expires_at ? new Date(subscription.expires_at) : null;
    const isActive =
      subscription.status === "active" && (!expiresAt || expiresAt > now);

    return {
      athleteId: athlete.id,
      status: subscription.status,
      plano: subscription.plan_code,
      dataInicio: subscription.start_date,
      dataExpiracao: subscription.expires_at,
      proximaCobranca: nextChargeDate,
      assinaturaAtiva: isActive,
      subscriptionId: subscription.id,
    };
  }

  // --------- POST /subscription/cancel ---------
  async cancel(athleteId: string, motivo?: string) {
    const { subscription } = await this.loadAthleteAndSubscription(athleteId);
    if (!subscription) throw new HttpError(404, "subscription_not_found", "Assinatura não encontrada");

    if (subscription.asaas_subscription_id) {
      await asaasRequest(`/subscriptions/${subscription.asaas_subscription_id}`, {
        method: "DELETE",
      });
    }

    const { data: updated, error } = await this.supabase
      .from("zn_subscriptions")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancellation_reason: motivo ?? null,
      })
      .eq("id", subscription.id)
      .select("*")
      .single();
    if (error) throw new HttpError(500, "db_update_failed", error.message);

    return { subscriptionId: updated.id, status: updated.status, cancelledAt: updated.cancelled_at };
  }

  // --------- POST /subscription/change-plan ---------
  async changePlan(athleteId: string, novoPlano: ZnPlan) {
    const { subscription } = await this.loadAthleteAndSubscription(athleteId);
    if (!subscription) throw new HttpError(404, "subscription_not_found", "Assinatura não encontrada");
    if (subscription.plan_code === novoPlano) {
      return { subscriptionId: subscription.id, plano: novoPlano, changed: false };
    }

    if (subscription.asaas_subscription_id) {
      const cycle = PLAN_TO_CYCLE[novoPlano];
      await asaasRequest(`/subscriptions/${subscription.asaas_subscription_id}`, {
        method: "PUT",
        body: JSON.stringify({ cycle, updatePendingPayments: true }),
      });
    }

    // Recalcula data de expiração a partir da data de início existente
    const start = subscription.start_date ? new Date(subscription.start_date) : new Date();
    const newExpires = new Date(start);
    newExpires.setMonth(newExpires.getMonth() + PLAN_MONTHS[novoPlano]);

    const { data: updated, error } = await this.supabase
      .from("zn_subscriptions")
      .update({
        plan_code: novoPlano,
        expires_at: newExpires.toISOString(),
      })
      .eq("id", subscription.id)
      .select("*")
      .single();
    if (error) throw new HttpError(500, "db_update_failed", error.message);

    return {
      subscriptionId: updated.id,
      plano: updated.plan_code,
      dataExpiracao: updated.expires_at,
      changed: true,
    };
  }

  // --------- POST /subscription/reactivate ---------
  async reactivate(athleteId: string) {
    const { subscription } = await this.loadAthleteAndSubscription(athleteId);
    if (!subscription) throw new HttpError(404, "subscription_not_found", "Assinatura não encontrada");

    // Asaas: assinaturas canceladas (DELETE) não podem ser reativadas — uma
    // nova precisa ser criada pelo checkout. Aqui apenas retomamos o registro
    // local para status "active" caso ainda haja assinatura Asaas viva
    // (ex: overdue/suspended). Se estiver cancelada, sinalizamos ao chamador.
    if (subscription.status === "cancelled" && !subscription.asaas_subscription_id) {
      throw new HttpError(
        409,
        "requires_new_checkout",
        "Assinatura cancelada — é necessário gerar novo checkout no Asaas",
      );
    }

    // Tenta reabrir no Asaas (idempotente: se já estiver ativa, o próprio
    // Asaas ignora). PUT com status ACTIVE não é oficial; a estratégia
    // padrão é apenas garantir cobrança futura via updatePendingPayments.
    if (subscription.asaas_subscription_id) {
      try {
        await asaasRequest(`/subscriptions/${subscription.asaas_subscription_id}`, {
          method: "PUT",
          body: JSON.stringify({ status: "ACTIVE", updatePendingPayments: true }),
        });
      } catch (err) {
        console.warn("[reactivate] Asaas PUT ignorado:", (err as Error).message);
      }
    }

    const { data: updated, error } = await this.supabase
      .from("zn_subscriptions")
      .update({
        status: "active",
        cancelled_at: null,
        cancellation_reason: null,
      })
      .eq("id", subscription.id)
      .select("*")
      .single();
    if (error) throw new HttpError(500, "db_update_failed", error.message);

    return { subscriptionId: updated.id, status: updated.status };
  }
}

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}
