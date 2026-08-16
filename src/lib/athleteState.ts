/**
 * ETAPA 1 — Estado operacional canônico do atleta.
 *
 * REGRA CENTRAL ÚNICA. Nenhuma tela deve reimplementar
 * `if (client.is_active && !client.is_frozen ...)`.
 * Espelha exatamente a view `public.v_client_operational_state` e a função
 * `public.is_client_operational(uuid)` no banco.
 */

export interface AthleteStateInput {
  is_active?: boolean | null;
  is_frozen?: boolean | null;
  archived_at?: string | null;
  ended_at?: string | null;
  end_date?: string | null;
  start_date?: string | null;
  athlete_status?: string | null;
  service_type?: string | null;
  has_checkin?: boolean | null;
  has_consultations?: boolean | null;
  consultation_count?: number | null;
}

export interface AthleteOperationalState {
  isOperational: boolean;
  isFrozen: boolean;
  isEnded: boolean;
  isArchived: boolean;
  isInOnboarding: boolean;
  hasNutrition: boolean;
  hasTraining: boolean;
  hasConsultations: boolean;
  canReceiveCheckins: boolean;
  canReceiveConsultationInvites: boolean;
  canReceiveMealPlanActions: boolean;
  canAppearInOperationalQueues: boolean;
  /** Motivos legíveis de bloqueio operacional (para UI/auditoria). */
  blockedReasons: string[];
}

function toDateOnly(value?: string | null): Date | null {
  if (!value) return null;
  const iso = value.length > 10 ? value.slice(0, 10) : value;
  const d = new Date(`${iso}T12:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

export function getAthleteState(
  client: AthleteStateInput | null | undefined,
  today: Date = new Date(),
): AthleteOperationalState {
  const c = client || {};
  const blockedReasons: string[] = [];

  const isFrozen = c.is_frozen === true;
  const isArchived = !!c.archived_at;
  const endDate = toDateOnly(c.end_date);
  const ref = toDateOnly(today.toISOString().slice(0, 10))!;
  const isEnded = !!c.ended_at || (!!endDate && endDate < ref);
  const isActive = c.is_active !== false;

  if (!isActive) blockedReasons.push('Atleta inativo');
  if (isFrozen) blockedReasons.push('Plano congelado');
  if (isArchived) blockedReasons.push('Atleta arquivado');
  if (isEnded) blockedReasons.push('Acompanhamento encerrado');

  const isOperational = isActive && !isFrozen && !isArchived && !isEnded;

  const serviceType = c.service_type || 'nutrition';
  const hasNutrition = serviceType === 'nutrition' || serviceType === 'both';
  const hasTraining = serviceType === 'training' || serviceType === 'both';
  const hasConsultations = c.has_consultations === true;

  // "Aguardando anamnese" é pendência de onboarding, NÃO status principal.
  const isInOnboarding = c.athlete_status === 'pending_anamnese';

  return {
    isOperational,
    isFrozen,
    isEnded,
    isArchived,
    isInOnboarding,
    hasNutrition,
    hasTraining,
    hasConsultations,
    canReceiveCheckins: isOperational && c.has_checkin === true,
    canReceiveConsultationInvites: isOperational && hasConsultations,
    canReceiveMealPlanActions: isOperational && hasNutrition,
    canAppearInOperationalQueues: isOperational,
    blockedReasons,
  };
}

/** Atalho para filtros de listas/filas operacionais. */
export function isOperationalAthlete(client: AthleteStateInput | null | undefined, today?: Date): boolean {
  return getAthleteState(client, today).isOperational;
}

/** Filtra qualquer coleção de atletas mantendo apenas os operacionais. */
export function filterOperational<T extends AthleteStateInput>(clients: T[], today?: Date): T[] {
  return (clients || []).filter((c) => isOperationalAthlete(c, today));
}
