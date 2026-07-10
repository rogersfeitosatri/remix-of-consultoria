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
  // Regra de estorno: se o cancelamento ocorrer em até 7 dias após o
  // primeiro pagamento confirmado, todos os pagamentos CONFIRMED/RECEIVED
  // da assinatura são estornados no Asaas antes do DELETE.
  async cancel(athleteId: string, motivo?: string) {
    const { athlete, subscription } = await this.loadAthleteAndSubscription(athleteId);
    if (!subscription) throw new HttpError(404, "subscription_not_found", "Assinatura não encontrada");

    const refunded: Array<{ id: string; value: number }> = [];
    let withinGrace = false;

    if (subscription.asaas_subscription_id) {
      // Lista pagamentos da assinatura para avaliar janela de 7 dias
      try {
        const payments = await asaasRequest<{
          data: Array<{
            id: string;
            status: string;
            value: number;
            paymentDate?: string | null;
            confirmedDate?: string | null;
            dueDate?: string | null;
          }>;
        }>(`/subscriptions/${subscription.asaas_subscription_id}/payments`);

        const first = [...(payments.data ?? [])]
          .filter((p) => p.paymentDate || p.confirmedDate)
          .sort((a, b) => {
            const da = new Date(a.paymentDate ?? a.confirmedDate ?? 0).getTime();
            const db = new Date(b.paymentDate ?? b.confirmedDate ?? 0).getTime();
            return da - db;
          })[0];

        if (first) {
          const firstPaid = new Date(first.paymentDate ?? first.confirmedDate ?? Date.now());
          const diffDays = (Date.now() - firstPaid.getTime()) / (1000 * 60 * 60 * 24);
          withinGrace = diffDays <= 7;
        }

        if (withinGrace) {
          for (const p of payments.data ?? []) {
            if (p.status === "CONFIRMED" || p.status === "RECEIVED") {
              try {
                await asaasRequest(`/payments/${p.id}/refund`, {
                  method: "POST",
                  body: JSON.stringify({ description: motivo ?? "Cancelamento em até 7 dias" }),
                });
                refunded.push({ id: p.id, value: p.value });
              } catch (err) {
                console.error(`[cancel] falha ao estornar ${p.id}:`, (err as Error).message);
              }
            }
          }
        }
      } catch (err) {
        console.warn("[cancel] listagem de pagamentos falhou:", (err as Error).message);
      }

      await asaasRequest(`/subscriptions/${subscription.asaas_subscription_id}`, {
        method: "DELETE",
      });
    }

    const cancelReason = motivo
      ? withinGrace
        ? `${motivo} (estorno em 7 dias)`
        : motivo
      : withinGrace
        ? "Cancelamento em até 7 dias — estornado"
        : null;

    const { data: updated, error } = await this.supabase
      .from("zn_subscriptions")
      .update({
        status: "cancelled",
        canceled_at: new Date().toISOString(),
        cancel_reason: cancelReason,
      })
      .eq("id", subscription.id)
      .select("*")
      .single();
    if (error) throw new HttpError(500, "db_update_failed", error.message);

    await this.dispatchSync(athlete, updated, "subscription_cancelled");
    return {
      subscriptionId: updated.id,
      status: updated.status,
      cancelledAt: updated.canceled_at,
      refunded: refunded.length > 0,
      refundedPayments: refunded,
      withinGracePeriod: withinGrace,
    };
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
