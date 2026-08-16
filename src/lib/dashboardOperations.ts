/**
 * ETAPA 2B — Operações canônicas do dashboard.
 *
 * Uma "operação" é qualquer coisa que exige ação do nutricionista.
 * Toda pendência do sistema (check-in, plano alimentar, anamnese, convite de
 * consulta, renovação, tarefa manual) é normalizada nesse formato único, para
 * que o dashboard seja a CENTRAL ÚNICA da operação — sem duplicidade e sem
 * "esconder" itens (não existe dismiss: só resolve ou some quando resolvido).
 */
import { addBusinessDays, businessDaysBetween, type HolidaySet } from './businessDays';

export type OperationKind =
  | 'checkin_review'
  | 'nutrition_review'
  | 'meal_plan'
  | 'anamnese_review'
  | 'booking_invite'
  | 'renewal'
  | 'manual_task'
  | 'legacy_task';

export type OperationBucket = 'overdue' | 'today' | 'upcoming';

export interface Operation {
  /** Chave estável: `${kind}:${sourceId}` */
  id: string;
  kind: OperationKind;
  clientId: string | null;
  clientName: string;
  clientPhone: string | null;
  title: string;
  subtitle?: string;
  /** Data-limite (yyyy-MM-dd). null = sem prazo definido. */
  dueDate: string | null;
  /** Quando a pendência nasceu (ISO). */
  createdAt: string | null;
  route: string;
  /** Fonte original, usada para deduplicar tarefas derivadas. */
  sourceType: string | null;
  sourceId: string | null;
}

export const OPERATION_LABEL: Record<OperationKind, string> = {
  checkin_review: 'Check-in aguardando devolutiva',
  nutrition_review: 'Revisão nutricional',
  meal_plan: 'Plano alimentar',
  anamnese_review: 'Anamnese para revisar',
  booking_invite: 'Convite de consulta',
  renewal: 'Renovação de plano',
  manual_task: 'Tarefa',
  legacy_task: 'Pendência antiga',
};

/** Prioridade de desempate quando duas operações vencem no mesmo dia. */
const KIND_WEIGHT: Record<OperationKind, number> = {
  checkin_review: 0,
  nutrition_review: 1,
  meal_plan: 2,
  anamnese_review: 3,
  booking_invite: 4,
  renewal: 5,
  manual_task: 6,
  legacy_task: 7,
};

export const SLA_BUSINESS_DAYS: Partial<Record<OperationKind, number>> = {
  checkin_review: 3,
  meal_plan: 3,
  anamnese_review: 3,
};


export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseKey(key: string): Date {
  return new Date(`${key.slice(0, 10)}T12:00:00`);
}

/** Data-limite = origem + N dias úteis (feriados respeitados). */
export function slaDueDate(
  from: string | Date,
  businessDays: number,
  holidays: HolidaySet = new Set(),
): string {
  const base = typeof from === 'string' ? parseKey(from.slice(0, 10)) : from;
  return toDateKey(addBusinessDays(base, businessDays, holidays));
}

export function bucketOf(op: Operation, today: Date = new Date()): OperationBucket {
  if (!op.dueDate) return 'upcoming';
  const t = toDateKey(today);
  if (op.dueDate < t) return 'overdue';
  if (op.dueDate === t) return 'today';
  return 'upcoming';
}

/** Dias úteis de atraso (0 quando ainda no prazo). */
export function overdueBusinessDays(
  op: Operation,
  holidays: HolidaySet = new Set(),
  today: Date = new Date(),
): number {
  if (!op.dueDate) return 0;
  const due = parseKey(op.dueDate);
  if (due >= today) return 0;
  return businessDaysBetween(due, today, holidays);
}

export function sortOperations(ops: Operation[]): Operation[] {
  return [...ops].sort((a, b) => {
    const ad = a.dueDate ?? '9999-12-31';
    const bd = b.dueDate ?? '9999-12-31';
    if (ad !== bd) return ad < bd ? -1 : 1;
    if (KIND_WEIGHT[a.kind] !== KIND_WEIGHT[b.kind]) return KIND_WEIGHT[a.kind] - KIND_WEIGHT[b.kind];
    return a.clientName.localeCompare(b.clientName);
  });
}

export function groupOperations(
  ops: Operation[],
  today: Date = new Date(),
): Record<OperationBucket, Operation[]> {
  const out: Record<OperationBucket, Operation[]> = { overdue: [], today: [], upcoming: [] };
  for (const op of sortOperations(ops)) out[bucketOf(op, today)].push(op);
  return out;
}

/**
 * Remove tarefas que apenas espelham uma pendência já listada
 * (mesma origem). A pendência real vence a tarefa derivada.
 */
export function dedupeOperations(ops: Operation[]): Operation[] {
  const claimed = new Set<string>();
  for (const op of ops) {
    if (op.kind === 'manual_task' || op.kind === 'legacy_task') continue;
    if (op.sourceType && op.sourceId) claimed.add(`${op.sourceType}:${op.sourceId}`);
  }
  const seen = new Set<string>();
  return ops.filter((op) => {
    if (seen.has(op.id)) return false;
    seen.add(op.id);
    if (op.kind !== 'manual_task' && op.kind !== 'legacy_task') return true;
    if (op.sourceType && op.sourceId && claimed.has(`${op.sourceType}:${op.sourceId}`)) return false;
    return true;
  });
}
