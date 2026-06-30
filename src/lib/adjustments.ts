// Lógica de "Ajustes mensais de dieta" para atletas de consultoria sem consultas
// recorrentes (0 ou 1 consulta inicial).
//
// Os ajustes acontecem mensalmente (a cada ~4 semanas), ancorados nos checkins
// enviados (sempre às segundas-feiras). A regra de QUAL checkin dispara o ajuste
// depende da frequência de checkin do atleta:
//
//   - mensal      → todo checkin (cada checkin já fecha 1 mês)      → 1, 2, 3, 4…
//   - quinzenal   → no 2º checkin e a cada 2 depois (≈15 dias)      → 2, 4, 6, 8…
//   - semanal     → no 3º checkin e a cada 4 depois                 → 3, 7, 11, 15…
//   - diário      → tratado como semanal (envio só às segundas)     → 3, 7, 11, 15…
//   - 3 semanas / bimestral / trimestral → todo checkin (≥ ~1 mês)  → 1, 2, 3…
//
// Referência de controle: a partir de 27/06/2026.

import { parseISO, isMonday, previousMonday, nextMonday, format, startOfDay } from 'date-fns';

export const ADJUSTMENTS_REFERENCE_START = '2026-06-27';

export type CheckinFrequency =
  | 'daily' | 'weekly' | 'biweekly' | 'three_weeks' | 'monthly' | 'bimonthly' | 'quarterly';

/**
 * Dado o índice (1-based) de um checkin na sequência, diz se ele dispara um ajuste.
 */
export function isAdjustmentCheckin(freq: CheckinFrequency | string | null, indexOneBased: number): boolean {
  if (indexOneBased < 1) return false;
  switch (freq) {
    case 'weekly':
    case 'daily':
      // 1º ajuste no 3º checkin, depois a cada 4 → 3, 7, 11, 15…
      return indexOneBased >= 3 && (indexOneBased - 3) % 4 === 0;
    case 'biweekly':
      // 2º checkin e a cada 2 → 2, 4, 6, 8…
      return indexOneBased >= 2 && (indexOneBased - 2) % 2 === 0;
    case 'three_weeks':
    case 'monthly':
    case 'bimonthly':
    case 'quarterly':
      // cada checkin já fecha ~1 mês (ou mais) → todo checkin
      return true;
    default:
      return true;
  }
}

/**
 * Rótulo legível da frequência.
 */
export function checkinFrequencyLabel(freq: CheckinFrequency | string | null): string {
  const map: Record<string, string> = {
    daily: 'Diário', weekly: 'Semanal', biweekly: 'Quinzenal', three_weeks: '3 semanas',
    monthly: 'Mensal', bimonthly: 'Bimestral', quarterly: 'Trimestral',
  };
  return (freq && map[freq]) || '—';
}

/**
 * Descrição curta da regra de ajuste para a frequência.
 */
export function adjustmentRuleLabel(freq: CheckinFrequency | string | null): string {
  switch (freq) {
    case 'weekly':
    case 'daily':
      return '3º checkin, depois a cada 4 (3º, 7º, 11º…)';
    case 'biweekly':
      return '2º checkin, depois a cada 2 (2º, 4º, 6º…)';
    case 'three_weeks':
    case 'monthly':
    case 'bimonthly':
    case 'quarterly':
      return 'Todo checkin';
    default:
      return 'Todo checkin';
  }
}

/**
 * Normaliza uma data qualquer para a segunda-feira "correspondente".
 * Se já é segunda, mantém; senão usa a segunda anterior (mantém o checkin da semana).
 */
export function toAnchorMonday(date: Date): Date {
  const d = startOfDay(date);
  return isMonday(d) ? d : previousMonday(d);
}

/** Segunda-feira de referência (>= max(hoje, 27/06/2026)). */
export function referenceMonday(today: Date = new Date()): Date {
  const ref = parseISO(ADJUSTMENTS_REFERENCE_START);
  const base = startOfDay(today) > ref ? startOfDay(today) : ref;
  return isMonday(base) ? base : nextMonday(base);
}

export interface CheckinPoint {
  date: string;        // yyyy-MM-dd (scheduled_send_date)
  sent: boolean;       // status sent/completed
}

export interface ClientAdjustment {
  /** Todas as datas de ajuste (segundas) yyyy-MM-dd, em ordem. */
  adjustmentDates: string[];
  /** Índice (1-based) do checkin de cada data de ajuste — para auditoria. */
  adjustmentCheckinIndices: number[];
  /** Nº de checkins já enviados. */
  sentCheckins: number;
  /** Nº total de checkins programados. */
  totalCheckins: number;
  /** Próxima data de ajuste (>= referência). */
  nextAdjustment: string | null;
  /** Última data de ajuste já passada (< referência). */
  lastAdjustment: string | null;
}

/**
 * Calcula as datas de ajuste de um atleta a partir dos seus checkins programados.
 * @param checkins lista de checkins (será ordenada por data)
 * @param freq frequência de checkin
 * @param fromDate referência (default: hoje) usada para next/last
 */
export function computeClientAdjustments(
  checkins: CheckinPoint[],
  freq: CheckinFrequency | string | null,
  fromDate: Date = new Date(),
): ClientAdjustment {
  const ordered = [...checkins]
    .filter((c) => !!c.date)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const adjustmentDates: string[] = [];
  const adjustmentCheckinIndices: number[] = [];
  ordered.forEach((c, i) => {
    if (isAdjustmentCheckin(freq, i + 1)) {
      adjustmentDates.push(c.date);
      adjustmentCheckinIndices.push(i + 1);
    }
  });

  const refStr = format(startOfDay(fromDate), 'yyyy-MM-dd');
  const nextAdjustment = adjustmentDates.find((d) => d >= refStr) ?? null;
  const past = adjustmentDates.filter((d) => d < refStr);
  const lastAdjustment = past.length ? past[past.length - 1] : null;

  return {
    adjustmentDates,
    adjustmentCheckinIndices,
    sentCheckins: ordered.filter((c) => c.sent).length,
    totalCheckins: ordered.length,
    nextAdjustment,
    lastAdjustment,
  };
}

/**
 * Identifica se um cliente é alvo de ajustes: consultoria, ativo, não congelado,
 * com checkin, e com 0 ou 1 consulta (sem consultas recorrentes).
 */
export function isAdjustmentTarget(c: {
  plan_type?: string | null;
  is_active?: boolean;
  is_frozen?: boolean;
  has_checkin?: boolean;
  checkin_frequency?: string | null;
  has_consultations?: boolean;
  consultation_count?: number | null;
}): boolean {
  if (c.plan_type !== 'consultoria') return false;
  if (!c.is_active || c.is_frozen) return false;
  if (!c.has_checkin || !c.checkin_frequency) return false;
  const consultas = c.has_consultations ? Number(c.consultation_count || 0) : 0;
  return consultas <= 1;
}
