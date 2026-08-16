/**
 * ETAPA 1 — Periodicidade canônica (check-in e consultas).
 * Fonte única de verdade para converter frequência em dias/semanas,
 * calcular próxima data e tolerância (grace).
 */

export type CheckinPeriodicity =
  | 'weekly'
  | 'biweekly'
  | 'three_weeks'
  | 'monthly'
  | 'bimonthly'
  | 'quarterly';

export type ConsultationPeriodicity = 'monthly' | 'biweekly' | 'weekly' | 'quarterly' | 'custom';

/**
 * ETAPA 3B — periodicidade canônica em MÚLTIPLOS DE SEMANA.
 * "Mensal" = 4 semanas (28 dias). Não existe mais frequência diária.
 */
const CHECKIN_WEEKS: Record<CheckinPeriodicity, number> = {
  weekly: 1,
  biweekly: 2,
  three_weeks: 3,
  monthly: 4,
  bimonthly: 8,
  quarterly: 12,
};

const CHECKIN_DAYS: Record<CheckinPeriodicity, number> = {
  weekly: 7,
  biweekly: 14,
  three_weeks: 21,
  monthly: 28,
  bimonthly: 56,
  quarterly: 84,
};

/** Tolerância canônica: intervalo + 2 dias. */
const GRACE_EXTRA_DAYS = 2;

export const CHECKIN_PERIODICITY_LABELS: Record<CheckinPeriodicity, string> = {
  weekly: 'Semanal',
  biweekly: 'Quinzenal',
  three_weeks: 'A cada 3 semanas',
  monthly: 'Mensal (4 semanas)',
  bimonthly: 'Bimestral (8 semanas)',
  quarterly: 'Trimestral (12 semanas)',
};

/** Frequências legadas que deixaram de existir são normalizadas para semanal. */
const LEGACY_MAP: Record<string, CheckinPeriodicity> = {
  daily: 'weekly',
  '3weeks': 'three_weeks',
  triweekly: 'three_weeks',
};

export function normalizeCheckinPeriodicity(value?: string | null): CheckinPeriodicity {
  const v = (value || '').toLowerCase();
  if (v in CHECKIN_DAYS) return v as CheckinPeriodicity;
  if (v in LEGACY_MAP) return LEGACY_MAP[v];
  return 'monthly';
}

export function checkinIntervalWeeks(value?: string | null): number {
  return CHECKIN_WEEKS[normalizeCheckinPeriodicity(value)];
}


export function checkinIntervalDays(value?: string | null): number {
  return CHECKIN_DAYS[normalizeCheckinPeriodicity(value)];
}

export function checkinGraceDays(value?: string | null): number {
  return CHECKIN_DAYS[normalizeCheckinPeriodicity(value)] + GRACE_EXTRA_DAYS;
}


/** Semanas entre consultas segundo a cadência do plano. */
export function consultationCadenceWeeks(value?: string | number | null): number {
  if (typeof value === 'number' && value > 0) return value;
  switch ((value || '').toString().toLowerCase()) {
    case 'weekly':
      return 1;
    case 'biweekly':
      return 2;
    case 'monthly':
      return 4;
    case 'quarterly':
      return 12;
    default:
      return 4;
  }
}

export function addDays(base: Date, days: number): Date {
  const d = new Date(base.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

/** Próxima data esperada a partir da última ocorrência. */
export function nextCheckinDate(last: Date, periodicity?: string | null): Date {
  return addDays(last, checkinIntervalDays(periodicity));
}

export function nextConsultationDate(last: Date, cadence?: string | number | null): Date {
  return addDays(last, consultationCadenceWeeks(cadence) * 7);
}

/** Está atrasado além da tolerância? */
export function isCheckinOverdue(last: Date | null, periodicity?: string | null, today: Date = new Date()): boolean {
  if (!last) return false;
  const diff = Math.floor((today.getTime() - last.getTime()) / 86400000);
  return diff > checkinGraceDays(periodicity);
}
