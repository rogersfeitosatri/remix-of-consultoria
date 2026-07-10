// ExternalSyncService — mantém API antiga usada pelo PaymentOrchestrator.
// Toda comunicação real com o Zona Nutri é feita por ZonaNutriSyncService.
// Este arquivo apenas ADAPTA o payload legado para o novo serviço.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { ZonaNutriSyncService, type ZnSyncEvent } from "./ZonaNutriSyncService.ts";

export interface SyncAthletePayload {
  owner_user_id: string;
  event: string;
  athlete: {
    id: string; email: string;
    name: string | null; phone: string | null; cpf_cnpj: string | null;
  };
  subscription: {
    id: string; plan_code: string; status: string;
    start_date: string | null; expires_at: string | null;
    asaas_customer_id: string | null; asaas_subscription_id: string | null;
    cancel_reason?: string | null;
  };
  payment?: unknown;
}

function mapEvent(evt: string): ZnSyncEvent {
  const e = evt.toLowerCase();
  if (e.includes("renew")) return "subscription_renewed";
  if (e.includes("cancel")) return "subscription_cancelled";
  if (e.includes("suspend") || e.includes("overdue")) return "subscription_suspended";
  if (e.includes("reactiv")) return "subscription_reactivated";
  if (e.includes("plan_changed") || e.includes("change_plan")) return "plan_changed";
  return "subscription_created";
}

export class ExternalSyncService {
  private zn: ZonaNutriSyncService;
  constructor(supabase: SupabaseClient, private log: (m: string, extra?: any) => void) {
    this.zn = new ZonaNutriSyncService(supabase, log);
  }

  async syncAthlete(input: SyncAthletePayload): Promise<void> {
    await this.zn.enqueueAndSend({
      owner_user_id: input.owner_user_id,
      event: mapEvent(input.event),
      athlete: {
        id: input.athlete.id,
        email: input.athlete.email,
        name: input.athlete.name,
        phone: input.athlete.phone,
      },
      subscription: {
        id: input.subscription.id,
        plan_code: input.subscription.plan_code,
        status: input.subscription.status,
        start_date: input.subscription.start_date,
        expires_at: input.subscription.expires_at,
        cancel_reason: input.subscription.cancel_reason ?? null,
      },
    });
  }
}
