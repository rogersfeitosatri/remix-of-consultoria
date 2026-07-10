// SubscriptionService — regras de assinatura ZN Assessoria.
// Calcula datas, transiciona status e mantém sincronia com Asaas.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import type { ZnPlanCode, ZnSubscriptionStatus } from "./types.ts";

const DURATION_MONTHS: Record<ZnPlanCode, number> = {
  monthly: 1,
  semiannual: 6,
  annual: 12,
};

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export class SubscriptionService {
  constructor(private supabase: SupabaseClient) {}

  computeExpiresAt(startDate: Date, plan: ZnPlanCode): string {
    return toISODate(addMonths(startDate, DURATION_MONTHS[plan]));
  }

  async findByAsaasIds(opts: {
    asaas_subscription_id?: string | null;
    asaas_customer_id?: string | null;
    athlete_id?: string | null;
  }) {
    let query = this.supabase.from("zn_subscriptions").select("*").limit(1);
    if (opts.asaas_subscription_id) {
      query = query.eq("asaas_subscription_id", opts.asaas_subscription_id);
    } else if (opts.athlete_id) {
      query = query.eq("athlete_id", opts.athlete_id).order("created_at", { ascending: false });
    } else if (opts.asaas_customer_id) {
      query = query.eq("asaas_customer_id", opts.asaas_customer_id).order("created_at", { ascending: false });
    } else {
      return null;
    }
    const { data } = await query.maybeSingle();
    return data;
  }

  async upsertFromPayment(input: {
    owner_user_id: string;
    athlete_id: string;
    plan: ZnPlanCode;
    asaas_customer_id?: string | null;
    asaas_subscription_id?: string | null;
    reference_date: Date; // data do pagamento confirmado
  }) {
    const existing = await this.findByAsaasIds({
      asaas_subscription_id: input.asaas_subscription_id,
      asaas_customer_id: input.asaas_customer_id,
      athlete_id: input.athlete_id,
    });

    const startBase = existing?.expires_at
      ? new Date(existing.expires_at + "T00:00:00Z") > input.reference_date
        ? new Date(existing.expires_at + "T00:00:00Z") // renovação enquanto ainda válido → empilha
        : input.reference_date
      : input.reference_date;

    const start_date = existing?.start_date ?? toISODate(input.reference_date);
    const expires_at = this.computeExpiresAt(startBase, input.plan);

    if (existing) {
      const { data, error } = await this.supabase
        .from("zn_subscriptions")
        .update({
          plan_code: input.plan,
          status: "active",
          expires_at,
          asaas_customer_id: input.asaas_customer_id ?? existing.asaas_customer_id,
          asaas_subscription_id: input.asaas_subscription_id ?? existing.asaas_subscription_id,
        })
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) throw new Error(`SubscriptionService.update: ${error.message}`);
      return data;
    }

    const { data, error } = await this.supabase
      .from("zn_subscriptions")
      .insert({
        user_id: input.owner_user_id,
        athlete_id: input.athlete_id,
        plan_code: input.plan,
        status: "active",
        start_date,
        expires_at,
        asaas_customer_id: input.asaas_customer_id ?? null,
        asaas_subscription_id: input.asaas_subscription_id ?? null,
      })
      .select("*")
      .single();
    if (error) throw new Error(`SubscriptionService.insert: ${error.message}`);
    return data;
  }

  async setStatus(id: string, status: ZnSubscriptionStatus, cancelReason?: string) {
    const patch: Record<string, unknown> = { status };
    if (status === "cancelled") {
      patch.canceled_at = new Date().toISOString();
      if (cancelReason) patch.cancel_reason = cancelReason;
    }
    const { error } = await this.supabase.from("zn_subscriptions").update(patch).eq("id", id);
    if (error) throw new Error(`SubscriptionService.setStatus: ${error.message}`);
  }
}
