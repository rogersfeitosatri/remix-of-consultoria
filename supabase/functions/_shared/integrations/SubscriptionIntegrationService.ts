// SubscriptionIntegrationService — TODA a regra de negócio dos endpoints da
// API pública vive aqui. Controllers (edge functions) apenas validam entrada,
// chamam o service e formatam a resposta.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { asaasRequest, PLAN_TO_CYCLE } from "./asaas.ts";
import type { ZnPlan } from "./dtos.ts";
import { ZonaNutriSyncService, type ZnSyncEvent } from "../zn/ZonaNutriSyncService.ts";

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
    const { athlete, subscription } = await this.loadAthleteAndSubscription(athleteId);
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
        canceled_at: new Date().toISOString(),
        cancel_reason: motivo ?? null,
      })
      .eq("id", subscription.id)
      .select("*")
      .single();
    if (error) throw new HttpError(500, "db_update_failed", error.message);

    await this.dispatchSync(athlete, updated, "subscription_cancelled");
    return { subscriptionId: updated.id, status: updated.status, cancelledAt: updated.canceled_at };
  }

  // --------- POST /subscription/change-plan ---------
  async changePlan(athleteId: string, novoPlano: ZnPlan) {
    const { athlete, subscription } = await this.loadAthleteAndSubscription(athleteId);
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

    await this.dispatchSync(athlete, updated, "plan_changed");
    return {
      subscriptionId: updated.id,
      plano: updated.plan_code,
      dataExpiracao: updated.expires_at,
      changed: true,
    };
  }

  // --------- POST /subscription/reactivate ---------
  async reactivate(athleteId: string) {
    const { athlete, subscription } = await this.loadAthleteAndSubscription(athleteId);
    if (!subscription) throw new HttpError(404, "subscription_not_found", "Assinatura não encontrada");

    if (subscription.status === "cancelled" && !subscription.asaas_subscription_id) {
      throw new HttpError(
        409,
        "requires_new_checkout",
        "Assinatura cancelada — é necessário gerar novo checkout no Asaas",
      );
    }

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
        canceled_at: null,
        cancel_reason: null,
      })
      .eq("id", subscription.id)
      .select("*")
      .single();
    if (error) throw new HttpError(500, "db_update_failed", error.message);

    await this.dispatchSync(athlete, updated, "subscription_reactivated");
    return { subscriptionId: updated.id, status: updated.status };
  }

  // --------- Sync helper (único ponto de saída) ---------
  private async dispatchSync(athlete: any, subscription: any, event: ZnSyncEvent) {
    try {
      const zn = new ZonaNutriSyncService(this.supabase);
      await zn.enqueueAndSend({
        owner_user_id: athlete.user_id,
        event,
        athlete: {
          id: athlete.id,
          email: athlete.email,
          name: athlete.name ?? null,
          phone: athlete.phone ?? null,
        },
        subscription: {
          id: subscription.id,
          plan_code: subscription.plan_code,
          status: subscription.status,
          start_date: subscription.start_date,
          expires_at: subscription.expires_at,
          cancel_reason: subscription.cancel_reason ?? null,
        },
      });
    } catch (e) {
      console.error("[dispatchSync] falhou (não bloqueia endpoint):", (e as Error).message);
    }
  }
}

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}
