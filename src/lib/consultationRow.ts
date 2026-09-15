/**
 * A decisão de uma linha da tela de Consultas.
 *
 * A tela mostrava o mesmo estado três vezes — a cadeia "Pendente → Pendente", o
 * selo "Link Pendente" e a linha "Último link: 17/08" — e as três podiam
 * discordar entre si. Este módulo é a fonte única: dado o estado do ciclo, ele
 * devolve UM rótulo e UMA próxima ação. Quem desenha a linha não decide nada.
 */

export type ConsultationState =
  | 'link_pending'
  | 'link_sent'
  | 'no_show'
  | 'booked'
  | 'awaiting_confirmation'
  | 'completed'
  | 'cancelled'
  | 'first_consult';

export type ActionKind = 'send' | 'resend' | 'confirm' | 'open' | 'none';

export interface RowAction {
  kind: ActionKind;
  label: string;
}

export interface ConsultationRow {
  state: ConsultationState;
  /** O único texto de estado da linha. */
  label: string;
  /** A única ação em destaque. As demais ficam no menu. */
  action: RowAction;
  /** Entra nos contadores que pedem trabalho do profissional. */
  needsWork: boolean;
}

const ROWS: Record<ConsultationState, { label: string; action: RowAction; needsWork: boolean }> = {
  link_pending: { label: 'Enviar o link', action: { kind: 'send', label: 'Enviar' }, needsWork: true },
  link_sent: { label: 'Aguardando o atleta', action: { kind: 'open', label: 'Ver' }, needsWork: false },
  no_show: { label: 'Sem resposta', action: { kind: 'resend', label: 'Reenviar' }, needsWork: true },
  booked: { label: 'Agendada', action: { kind: 'open', label: 'Ver' }, needsWork: false },
  awaiting_confirmation: { label: 'Aconteceu?', action: { kind: 'confirm', label: 'Confirmar' }, needsWork: true },
  completed: { label: 'Realizada', action: { kind: 'open', label: 'Ver' }, needsWork: false },
  cancelled: { label: 'Cancelada', action: { kind: 'none', label: '' }, needsWork: false },
  first_consult: { label: '1ª consulta prevista', action: { kind: 'open', label: 'Ver' }, needsWork: false },
};

export function decideRow(state: ConsultationState): ConsultationRow {
  const found = Object.prototype.hasOwnProperty.call(ROWS, state) ? ROWS[state] : null;
  if (!found) return { state: 'link_pending', ...ROWS.link_pending };
  return { state, ...found };
}

/** Os estados que somam nos contadores do topo. O resto é histórico. */
export const WORK_STATES: ConsultationState[] = (Object.keys(ROWS) as ConsultationState[])
  .filter((s) => ROWS[s].needsWork);

export interface ScheduleForNumbering {
  id: string;
  scheduled_date: string;
}

/**
 * A posição da consulta DENTRO DO CICLO ATUAL.
 *
 * Antes contava a vida inteira do atleta contra o total do plano vigente, e
 * produzia "Consulta #9/6". Uma renovação grava um `start_date` novo, então o
 * ciclo atual é o conjunto de agendas a partir dessa data.
 *
 * Quando a posição passa do total contratado — acontece quando um ciclo de
 * envio ficou para trás sem virar consulta — mostra só "#7", sem a fração: uma
 * fração que estoura mente mais do que informa.
 */
export function consultationNumber(
  schedules: ScheduleForNumbering[],
  scheduleId: string,
  cycleStart: string | null | undefined,
  planTotal: number | null | undefined,
): string | null {
  const cycle = schedules
    .filter((s) => !cycleStart || s.scheduled_date >= cycleStart)
    .sort((a, b) => (a.scheduled_date === b.scheduled_date
      ? a.id.localeCompare(b.id)
      : a.scheduled_date.localeCompare(b.scheduled_date)));

  const position = cycle.findIndex((s) => s.id === scheduleId) + 1;
  if (position <= 0) return null;

  const total = typeof planTotal === 'number' && planTotal > 0 ? planTotal : null;
  return total && position <= total ? `#${position}/${total}` : `#${position}`;
}
