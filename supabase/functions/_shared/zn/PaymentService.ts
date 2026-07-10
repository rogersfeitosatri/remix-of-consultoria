// PaymentService — registra/atualiza cobranças ZN Assessoria em zn_payments.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  mapAsaasBillingType,
  mapAsaasPaymentStatus,
  type AsaasPayment,
  type ZnPaymentStatus,
} from "./types.ts";

export class PaymentService {
  constructor(private supabase: SupabaseClient) {}

  async upsertFromAsaas(input: {
    owner_user_id: string;
    athlete_id?: string | null;
    subscription_id?: string | null;
    event_type: string;
    payment: AsaasPayment;
    raw_event: unknown;
  }) {
    const p = input.payment;
    const status: ZnPaymentStatus = deriveStatus(input.event_type, p.status);

    const row = {
      user_id: input.owner_user_id,
      athlete_id: input.athlete_id ?? null,
      subscription_id: input.subscription_id ?? null,
      asaas_payment_id: p.id,
      asaas_customer_id: p.customer ?? null,
      asaas_subscription_id: p.subscription ?? null,
      amount: Number(p.value ?? 0),
      net_amount: p.netValue != null ? Number(p.netValue) : null,
      status,
      billing_type: mapAsaasBillingType(p.billingType),
      due_date: p.dueDate ?? null,
      paid_at:
        status === "confirmed" || status === "received"
          ? (p.paymentDate ?? new Date().toISOString())
          : null,
      invoice_url: p.invoiceUrl ?? null,
      event_type: input.event_type,
      raw_event: input.raw_event as Record<string, unknown>,
    };

    const { data, error } = await this.supabase
      .from("zn_payments")
      .upsert(row, { onConflict: "asaas_payment_id" })
      .select("*")
      .single();
    if (error) throw new Error(`PaymentService.upsert: ${error.message}`);
    return data;
  }
}

function deriveStatus(eventType: string, asaasStatus?: string): ZnPaymentStatus {
  const ev = eventType.toUpperCase();
  if (ev === "PAYMENT_CONFIRMED") return "confirmed";
  if (ev === "PAYMENT_RECEIVED") return "received";
  if (ev === "PAYMENT_OVERDUE") return "overdue";
  if (ev === "PAYMENT_REFUNDED") return "refunded";
  if (ev === "PAYMENT_DELETED") return "deleted";
  if (ev === "PAYMENT_CHARGEBACK_REQUESTED" || ev === "PAYMENT_CHARGEBACK_DISPUTE") return "failed";
  return mapAsaasPaymentStatus(asaasStatus);
}
