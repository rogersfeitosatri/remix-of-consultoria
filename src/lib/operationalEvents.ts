/**
 * ETAPA 1 — Registro central de eventos operacionais (auditoria).
 * Toda ação relevante (congelar, retomar, encerrar, arquivar, disparo,
 * geração/envio de plano, agendamento) deve ser registrada por aqui.
 */
import { supabase } from '@/integrations/supabase/client';

export type OperationalEntityType =
  | 'client'
  | 'appointment'
  | 'consultation_schedule'
  | 'checkin_dispatch'
  | 'checkin_response'
  | 'meal_plan'
  | 'task'
  | 'race'
  | 'checkin_form'
  | 'anamnese_form'
  | 'question_template'
  | 'nutrition_review';


export type OperationalEventType =
  | 'client_frozen'
  | 'client_unfrozen'
  | 'client_ended'
  | 'client_archived'
  | 'client_reactivated'
  | 'appointment_frozen'
  | 'appointment_unfrozen'
  | 'appointment_scheduled'
  | 'appointment_cancelled'
  | 'checkin_dispatch_sent'
  | 'checkin_dispatch_blocked'
  | 'checkin_response_received'
  | 'meal_plan_generated'
  | 'meal_plan_sent'
  | 'task_created'
  | 'task_completed'
  | 'race_updated'
  // ETAPA 3C — formulários versionados
  | 'checkin_form_created'
  | 'checkin_form_version_created'
  | 'checkin_form_version_published'
  | 'checkin_form_archived'
  | 'athlete_checkin_form_override_set'
  | 'athlete_checkin_form_override_removed'
  | 'anamnese_form_version_published'
  | 'anamnese_form_archived'
  | 'question_template_created'
  // ETAPA 4B — calendário operacional
  | 'booking_link_sent_manual'
  | 'appointment_completed'
  | 'appointment_rescheduled'
  // ETAPA 5A — revisões nutricionais
  | 'nutrition_review_completed'
  | 'nutrition_review_rescheduled'
  | 'nutrition_review_cancelled'
  | 'nutrition_review_created'
  // ETAPA 6B — plano alimentar canônico
  | 'meal_plan_version_created'
  | 'meal_plan_version_published'
  | 'legacy_plan_migrated'
  | 'legacy_plan_migration_needs_review'
  | 'legacy_meal_plan_fallback_used';



export interface LogEventInput {
  clientId?: string | null;
  entityType: OperationalEntityType;
  entityId?: string | null;
  eventType: OperationalEventType;
  source?: 'app' | 'edge' | 'cron' | 'import';
  metadata?: Record<string, unknown>;
}

/** Nunca lança: auditoria não pode quebrar o fluxo do usuário. */
export async function logOperationalEvent(input: LogEventInput): Promise<void> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id;
    if (!userId) return;

    await supabase.from('operational_events' as never).insert({
      user_id: userId,
      actor_user_id: userId,
      client_id: input.clientId ?? null,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      event_type: input.eventType,
      source: input.source ?? 'app',
      metadata: input.metadata ?? {},
    } as never);
  } catch (e) {
    console.warn('[operational_events] falha ao registrar evento', e);
  }
}
