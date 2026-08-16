/**
 * ETAPA 1 — Periodicidade canônica (check-in e consultas).
 * Fonte única de verdade para converter frequência em dias/semanas,
 * calcular próxima data e tolerância (grace).
 */

export type CheckinPeriodicity =
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'bimonthly'
  | 'quarterly';

export type ConsultationPeriodicity = 'monthly' | 'biweekly' | 'weekly' | 'quarterly' | 'custom';

const CHECKIN_DAYS: Record<CheckinPeriodicity, number> = {
  daily: 1,
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  bimonthly: 60,
  quarterly: 90,
};

const CHECKIN_GRACE_DAYS: Record<CheckinPeriodicity, number> = {
  daily: 2,
  weekly: 9,
  biweekly: 16,
  monthly: 35,
  bimonthly: 65,
  quarterly: 95,
};

export const CHECKIN_PERIODICITY_LABELS: Record<CheckinPeriodicity, string> = {
  daily: 'Diário',
  weekly: 'Semanal',
  biweekly: 'Quinzenal',
  monthly: 'Mensal',
  bimonthly: 'Bimestral',
  quarterly: 'Trimestral',
};

export function normalizeCheckinPeriodicity(value?: string | null): CheckinPeriodicity {
  const v = (value || '').toLowerCase();
  return (v in CHECKIN_DAYS ? v : 'monthly') as CheckinPeriodicity;
}

export function checkinIntervalDays(value?: string | null): number {
  return CHECKIN_DAYS[normalizeCheckinPeriodicity(value)];
}

export function checkinGraceDays(value?: string | null): number {
  return CHECKIN_GRACE_DAYS[normalizeCheckinPeriodicity(value)];
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
