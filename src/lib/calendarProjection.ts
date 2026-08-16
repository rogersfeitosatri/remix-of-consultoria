/**
 * ETAPA 4B — Projeção canônica do calendário.
 *
 * O calendário NÃO inventa eventos: ele apenas projeta o que já existe em
 * fontes canônicas (appointments, consultation_schedules e a camada
 * operacional da Etapa 2B). Datas "previstas" (ex.: first_consultation_date)
 * NÃO viram evento de agenda — elas pertencem ao pipeline.
 */
import type { Operation, OperationBucket } from './dashboardOperations';
import { bucketOf, sortOperations } from './dashboardOperations';

export const ACTIVE_APPOINTMENT_STATUSES = ['scheduled', 'confirmed'] as const;

export interface AppointmentLike {
  id: string;
  client_id: string;
  appointment_date: string;
  appointment_time?: string | null;
  status: string;
  consultation_schedule_id?: string | null;
  google_calendar_event_id?: string | null;
  google_meet_link?: string | null;
  frozen_at?: string | null;
  client?: { name?: string | null } | null;
}

export interface ScheduleLike {
  id: string;
  client_id: string;
  client_name?: string;
  send_link_date: string;
  scheduled_date?: string;
  status: string;
  appointment_id?: string | null;
  link_sent_at?: string | null;
}

export function isActiveAppointment(a: Pick<AppointmentLike, 'status'>): boolean {
  return (ACTIVE_APPOINTMENT_STATUSES as readonly string[]).includes(a.status);
}

export function isCompletedAppointment(a: Pick<AppointmentLike, 'status'>): boolean {
  return a.status === 'completed';
}

export function isCancelledAppointment(a: Pick<AppointmentLike, 'status'>): boolean {
  return a.status === 'cancelled' || a.status === 'no_show';
}

export function isFrozenAppointment(a: Pick<AppointmentLike, 'frozen_at'>): boolean {
  return !!a.frozen_at;
}

/** Consulta ativa cuja data já passou: exige confirmação (realizada / não realizada). */
export function appointmentNeedsAttention(a: AppointmentLike, todayKey: string): boolean {
  return isActiveAppointment(a) && !isFrozenAppointment(a) && a.appointment_date < todayKey;
}

export type GoogleSyncState = 'synced' | 'pending' | 'meet_missing';

export function googleSyncState(a: AppointmentLike): GoogleSyncState {
  if (!a.google_calendar_event_id) return 'pending';
  if (!a.google_meet_link) return 'meet_missing';
  return 'synced';
}

/** Vínculo canônico schedule <-> appointment (nunca por "mesma data"). */
export function appointmentForSchedule(
  schedule: ScheduleLike,
  appointments: AppointmentLike[],
): AppointmentLike | null {
  if (schedule.appointment_id) {
    const direct = appointments.find((a) => a.id === schedule.appointment_id);
    if (direct) return direct;
  }
  return appointments.find((a) => a.consultation_schedule_id === schedule.id) ?? null;
}

export function isPendingSendLink(schedule: ScheduleLike, appointments: AppointmentLike[]): boolean {
  if (schedule.status !== 'pending') return false;
  const apt = appointmentForSchedule(schedule, appointments);
  return !apt || isCancelledAppointment(apt);
}

export type CalendarEvent =
  | { type: 'appointment'; key: string; appointment: AppointmentLike; needsAttention: boolean }
  | { type: 'send_link'; key: string; schedule: ScheduleLike };

/** Eventos reais de um dia: consultas (ativas/realizadas) + envios de link pendentes. */
export function calendarEventsForDate(
  appointments: AppointmentLike[],
  schedules: ScheduleLike[],
  dateKey: string,
  todayKey: string,
): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  appointments
    .filter((a) => a.appointment_date === dateKey && !isCancelledAppointment(a))
    .sort((a, b) => (a.appointment_time || '').localeCompare(b.appointment_time || ''))
    .forEach((appointment) => {
      events.push({
        type: 'appointment',
        key: `apt-${appointment.id}`,
        appointment,
        needsAttention: appointmentNeedsAttention(appointment, todayKey),
      });
    });

  schedules
    .filter((s) => s.send_link_date === dateKey && isPendingSendLink(s, appointments))
    .forEach((schedule) => {
      events.push({ type: 'send_link', key: `link-${schedule.id}`, schedule });
    });

  return events;
}

export interface WeekStats {
  appointments: number;
  attention: number;
  pendingLinks: number;
  sentLinks: number;
}

export function weekStats(
  days: string[],
  appointments: AppointmentLike[],
  schedules: ScheduleLike[],
  sentByDay: Map<string, number>,
  todayKey: string,
): WeekStats {
  const stats: WeekStats = { appointments: 0, attention: 0, pendingLinks: 0, sentLinks: 0 };
  days.forEach((dateKey) => {
    stats.sentLinks += sentByDay.get(dateKey) ?? 0;
    calendarEventsForDate(appointments, schedules, dateKey, todayKey).forEach((ev) => {
      if (ev.type === 'appointment') {
        stats.appointments += 1;
        if (ev.needsAttention) stats.attention += 1;
      } else {
        stats.pendingLinks += 1;
      }
    });
  });
  return stats;
}

/**
 * Uma operação derivada só pode ser resolvida na entidade de origem
 * (check-in, plano, anamnese...). Tarefa manual pode ser concluída direto.
 */
export function isManualOperation(op: Operation): boolean {
  return op.kind === 'manual_task' || op.kind === 'legacy_task';
}

export interface DayAgendaSections {
  overdue: Operation[];
  today: Operation[];
  appointments: AppointmentLike[];
  attention: AppointmentLike[];
  total: number;
}

/**
 * Agenda do dia usa EXATAMENTE a mesma camada do dashboard (SLA em dias úteis,
 * dedupe e buckets). Para o dia de hoje mostramos também o atrasado;
 * para outros dias, apenas o que vence naquele dia.
 */
export function dayAgendaSections(
  operations: Operation[],
  appointments: AppointmentLike[],
  dateKey: string,
  today: Date,
): DayAgendaSections {
  const todayKey = today.toISOString().slice(0, 10);
  const isToday = dateKey === todayKey;

  const scoped = operations.filter((op) => {
    if (op.dueDate === dateKey) return true;
    if (!isToday) return false;
    const bucket: OperationBucket = bucketOf(op, today);
    return bucket === 'overdue';
  });

  const overdue = sortOperations(scoped.filter((op) => bucketOf(op, today) === 'overdue'));
  const dayOps = sortOperations(scoped.filter((op) => bucketOf(op, today) !== 'overdue'));

  const dayAppointments = appointments
    .filter((a) => a.appointment_date === dateKey && !isCancelledAppointment(a))
    .sort((a, b) => (a.appointment_time || '').localeCompare(b.appointment_time || ''));

  const attention = dayAppointments.filter((a) => appointmentNeedsAttention(a, todayKey));

  return {
    overdue,
    today: dayOps,
    appointments: dayAppointments,
    attention,
    total: overdue.length + dayOps.length + dayAppointments.length,
  };
}
