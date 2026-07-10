// IntegrationService — STUB para integração futura com Zona Nutri.
// Nesta fase apenas enfileira o evento em zn_integration_outbox.
// Nenhuma chamada HTTP externa é feita.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type ZnOutboxEvent =
  | "athlete.upserted"
  | "subscription.activated"
  | "subscription.renewed"
  | "subscription.cancelled"
  | "payment.confirmed"
  | "payment.refunded";

export class IntegrationService {
  constructor(private supabase: SupabaseClient) {}

  async enqueue(input: {
    owner_user_id: string;
    athlete_id?: string | null;
    subscription_id?: string | null;
    event_type: ZnOutboxEvent;
    payload: Record<string, unknown>;
  }) {
    const { error } = await this.supabase.from("zn_integration_outbox").insert({
      user_id: input.owner_user_id,
      athlete_id: input.athlete_id ?? null,
      subscription_id: input.subscription_id ?? null,
      event_type: input.event_type,
      payload: input.payload,
      status: "pending",
    });
    if (error) {
      // Não deve derrubar o webhook. Apenas loga.
      console.error("IntegrationService.enqueue:", error.message);
    }
  }
}
