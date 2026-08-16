/**
 * ETAPA 5A — Revisão nutricional canônica.
 *
 * A revisão nutricional é uma OBRIGAÇÃO CLÍNICA PERIÓDICA com cadência FIXA.
 * Ela NÃO nasce de check-in, nem de posição de check-in (3º, 7º…), nem de
 * "segunda mais próxima", nem de aniversário de contrato.
 *
 * Regra oficial única:
 *   próxima revisão = referência do ciclo + intervalo configurado
 *   referência = última revisão concluída/cancelada do ciclo, senão início do ciclo
 *
 * O intervalo vem, nesta ordem:
 *   1. override individual do atleta (clients.nutrition_review_interval_days)
 *   2. regra do plano/produto (plan_templates.nutrition_review_interval_days)
 *   3. padrão central (DEFAULT_REVIEW_INTERVAL_DAYS)
 */

export const DEFAULT_REVIEW_INTERVAL_DAYS = 28;

export type ReviewStatus =
  | 'scheduled'
  | 'pending'
  | 'waiting_information'
  | 'in_review'
  | 'paused'
  | 'completed'
  | 'cancelled';

export type ReviewDecision =
  | 'no_change'
  | 'change_proposed'
  | 'change_published'
  | 'manual_override'
  | 'not_applicable';

export type ReviewSource = 'cadence' | 'manual_extra_review' | 'migrated';

export interface NutritionReview {
  id: string;
  user_id: string;
  client_id: string;
  cycle_key: string;
  cycle_start: string | null;
  scheduled_for: string;
  interval_days: number;
  status: ReviewStatus;
  decision: ReviewDecision | null;
  source: ReviewSource;
  override_without_checkin: boolean;
  missing_information: string | null;
  notes: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  source_plan_version_id: string | null;
  result_plan_version_id: string | null;
  needs_review: boolean;
  cancel_reason: string | null;
  last_notified_at: string | null;
  notification_count: number;
  metadata: Record<string, unknown>;
  /** Check-in do ciclo que carrega a revisão estrutural (nunca um check-in extra). */
  checkin_dispatch_id: string | null;
  /** Resposta do atleta a esse check-in — principal insumo da revisão. */
  checkin_response_id: string | null;
  is_structural: boolean;
  created_at: string;
  updated_at: string;

}

export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  scheduled: 'Prevista',
  pending: 'Pendente',
  waiting_information: 'Aguardando informação',
  in_review: 'Em revisão',
  paused: 'Pausada (congelado)',
  completed: 'Concluída',
  cancelled: 'Cancelada',
};

export const REVIEW_DECISION_LABEL: Record<ReviewDecision, string> = {
  no_change: 'Sem necessidade de alteração',
  change_proposed: 'Alteração proposta',
  change_published: 'Alteração publicada',
  manual_override: 'Revisada com dados disponíveis',
  not_applicable: 'Não aplicável',
};

export const OPEN_STATUSES: ReviewStatus[] = [
  'scheduled',
  'pending',
  'waiting_information',
  'in_review',
  'paused',
];

export function isOpenReview(r: Pick<NutritionReview, 'status'>): boolean {
  return OPEN_STATUSES.includes(r.status);
}

/** Intervalo efetivo (override individual > produto > padrão central). */
export function effectiveIntervalDays(
  clientOverride?: number | null,
  productInterval?: number | null,
): number {
  if (clientOverride && clientOverride > 0) return clientOverride;
  if (productInterval && productInterval > 0) return productInterval;
  return DEFAULT_REVIEW_INTERVAL_DAYS;
}

export function todayKey(today: Date = new Date()): string {
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysKey(dateKey: string, days: number): string {
  const d = new Date(`${dateKey.slice(0, 10)}T12:00:00`);
  d.setDate(d.getDate() + days);
  return todayKey(d);
}

/**
 * Data prevista da PRÓXIMA revisão, sem criar backlog:
 * no máximo uma revisão vencida.
 */
export function nextScheduledFor(
  reference: string,
  intervalDays: number,
  today: string = todayKey(),
): string {
  let next = addDaysKey(reference, intervalDays);
  while (addDaysKey(next, intervalDays) <= today) {
    next = addDaysKey(next, intervalDays);
  }
  return next;
}

export type ReviewBucket = 'pending' | 'upcoming' | 'history';

/** Bucket funcional da área Ajustes: PENDENTES / PRÓXIMAS / HISTÓRICO. */
export function reviewBucket(
  r: Pick<NutritionReview, 'status' | 'scheduled_for'>,
  today: string = todayKey(),
): ReviewBucket {
  if (r.status === 'completed' || r.status === 'cancelled') return 'history';
  if (r.scheduled_for <= today) return 'pending';
  return 'upcoming';
}

/** "Pendência real" para o Dashboard (data chegou e não foi concluída). */
export function isDashboardObligation(
  r: Pick<NutritionReview, 'status' | 'scheduled_for'>,
  today: string = todayKey(),
): boolean {
  if (r.status === 'completed' || r.status === 'cancelled' || r.status === 'paused') return false;
  if (r.status === 'waiting_information') return true;
  return r.scheduled_for <= today;
}

/** Última revisão REAL concluída (nunca uma data teórica). */
export function lastCompletedReview(reviews: NutritionReview[]): NutritionReview | null {
  const done = reviews
    .filter((r) => r.status === 'completed')
    .sort((a, b) => (a.reviewed_at || a.scheduled_for) < (b.reviewed_at || b.scheduled_for) ? 1 : -1);
  return done[0] ?? null;
}

/** Próxima revisão materializada (entidade real, nunca cálculo de tela). */
export function nextOpenReview(reviews: NutritionReview[]): NutritionReview | null {
  const open = reviews.filter(isOpenReview).sort((a, b) => (a.scheduled_for < b.scheduled_for ? -1 : 1));
  return open[0] ?? null;
}
