import { describe, expect, it } from 'vitest';
import {
  appointmentForSchedule,
  appointmentNeedsAttention,
  calendarEventsForDate,
  dayAgendaSections,
  googleSyncState,
  isManualOperation,
  isPendingSendLink,
  weekStats,
  type AppointmentLike,
  type ScheduleLike,
} from './calendarProjection';
import type { Operation } from './dashboardOperations';

const apt = (over: Partial<AppointmentLike> = {}): AppointmentLike => ({
  id: 'a1',
  client_id: 'c1',
  appointment_date: '2026-03-10',
  appointment_time: '09:00',
  status: 'scheduled',
  ...over,
});

const sched = (over: Partial<ScheduleLike> = {}): ScheduleLike => ({
  id: 's1',
  client_id: 'c1',
  client_name: 'Ana',
  send_link_date: '2026-03-05',
  status: 'pending',
  ...over,
});

const op = (over: Partial<Operation> = {}): Operation => ({
  id: 'checkin_review:1',
  kind: 'checkin_review',
  clientId: 'c1',
  clientName: 'Ana',
  clientPhone: null,
  title: 'Check-in',
  dueDate: '2026-03-10',
  createdAt: null,
  route: '/check-ins',
  sourceType: null,
  sourceId: null,
  ...over,
});

describe('projeção do calendário', () => {
  it('não cria evento a partir de data prevista, apenas de appointments reais', () => {
    const events = calendarEventsForDate([], [], '2026-03-10', '2026-03-10');
    expect(events).toHaveLength(0);
  });

  it('mostra consulta realizada no passado e ignora cancelada', () => {
    const events = calendarEventsForDate(
      [apt({ status: 'completed' }), apt({ id: 'a2', status: 'cancelled' })],
      [],
      '2026-03-10',
      '2026-04-01',
    );
    expect(events.map((e) => e.key)).toEqual(['apt-a1']);
  });

  it('marca consulta ativa vencida como pendente de confirmação', () => {
    expect(appointmentNeedsAttention(apt(), '2026-03-12')).toBe(true);
    expect(appointmentNeedsAttention(apt(), '2026-03-10')).toBe(false);
    expect(appointmentNeedsAttention(apt({ status: 'completed' }), '2026-03-12')).toBe(false);
    expect(appointmentNeedsAttention(apt({ frozen_at: 'x' }), '2026-03-12')).toBe(false);
  });

  it('vincula schedule ao appointment por id canônico (não por data)', () => {
    const a = apt({ id: 'a9' });
    expect(appointmentForSchedule(sched({ appointment_id: 'a9' }), [a])?.id).toBe('a9');
    expect(appointmentForSchedule(sched(), [apt({ consultation_schedule_id: 's1' })])?.id).toBe('a1');
    expect(appointmentForSchedule(sched(), [a])).toBeNull();
  });

  it('envio de link some quando já existe consulta vinculada', () => {
    expect(isPendingSendLink(sched(), [])).toBe(true);
    expect(isPendingSendLink(sched({ appointment_id: 'a1' }), [apt()])).toBe(false);
    expect(isPendingSendLink(sched({ appointment_id: 'a1' }), [apt({ status: 'cancelled' })])).toBe(true);
    expect(isPendingSendLink(sched({ status: 'sent' }), [])).toBe(false);
  });

  it('resumo semanal conta consultas, atenção e envios', () => {
    const stats = weekStats(
      ['2026-03-05', '2026-03-10'],
      [apt()],
      [sched()],
      new Map([['2026-03-05', 2]]),
      '2026-03-12',
    );
    expect(stats).toEqual({ appointments: 1, attention: 1, pendingLinks: 1, sentLinks: 2 });
  });

  it('estado de sincronização com o Google', () => {
    expect(googleSyncState(apt())).toBe('pending');
    expect(googleSyncState(apt({ google_calendar_event_id: 'g' }))).toBe('meet_missing');
    expect(googleSyncState(apt({ google_calendar_event_id: 'g', google_meet_link: 'm' }))).toBe('synced');
  });
});

describe('agenda do dia', () => {
  const today = new Date('2026-03-10T12:00:00');

  it('usa a mesma camada do dashboard: atrasadas + do dia', () => {
    const sections = dayAgendaSections(
      [op({ id: 'x', dueDate: '2026-03-05' }), op({ id: 'y', dueDate: '2026-03-10' })],
      [apt()],
      '2026-03-10',
      today,
    );
    expect(sections.overdue.map((o) => o.id)).toEqual(['x']);
    expect(sections.today.map((o) => o.id)).toEqual(['y']);
    expect(sections.appointments).toHaveLength(1);
    expect(sections.total).toBe(3);
  });

  it('em outro dia mostra apenas o que vence naquele dia', () => {
    const sections = dayAgendaSections(
      [op({ id: 'x', dueDate: '2026-03-05' }), op({ id: 'z', dueDate: '2026-03-12' })],
      [],
      '2026-03-12',
      today,
    );
    expect(sections.overdue).toHaveLength(0);
    expect(sections.today.map((o) => o.id)).toEqual(['z']);
  });

  it('somente tarefas manuais podem ser concluídas na agenda', () => {
    expect(isManualOperation(op({ kind: 'manual_task' }))).toBe(true);
    expect(isManualOperation(op({ kind: 'checkin_review' }))).toBe(false);
  });
});
