// ExternalSyncService — ponto ÚNICO de sincronização com sistemas externos
// (futuro: Zona Nutri). Nesta fase apenas LOGA e enfileira em outbox.
// Nenhuma chamada HTTP externa é feita.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export interface SyncAthletePayload {
  owner_user_id: string;
  event: string; // ex: "subscription.activated"
  athlete: {
    id: string;
    email: string;
    name: string | null;
    phone: string | null;
    cpf_cnpj: string | null;
  };
  subscription: {
    id: string;
    plan_code: string;
    status: string;
    start_date: string | null;
    expires_at: string | null;
    asaas_customer_id: string | null;
    asaas_subscription_id: string | null;
  };
  payment?: {
    id: string;
    amount: number;
    status: string;
    paid_at: string | null;
  } | null;
}

export class ExternalSyncService {
  constructor(private supabase: SupabaseClient, private log: (m: string, extra?: any) => void) {}

  /**
   * Ponto único de saída para Zona Nutri (ou qualquer sistema externo).
   * NÃO faz HTTP nesta versão — apenas registra em log e persiste na outbox
   * para envio futuro. Toda evolução da integração vive aqui.
   */
  async syncAthlete(input: SyncAthletePayload): Promise<void> {
    this.log("[sync] Sincronização preparada (ainda não envia HTTP)", {
      event: input.event,
      athlete_id: input.athlete.id,
      subscription_id: input.subscription.id,
      plan: input.subscription.plan_code,
      status: input.subscription.status,
      expires_at: input.subscription.expires_at,
    });

    const { error } = await this.supabase.from("zn_integration_outbox").insert({
      user_id: input.owner_user_id,
      athlete_id: input.athlete.id,
      subscription_id: input.subscription.id,
      event_type: input.event,
      payload: input,
      status: "pending",
    });
    if (error) {
      // Nunca derruba o webhook.
      this.log("[sync] Falha ao enfileirar outbox", { error: error.message });
    }
  }
}
