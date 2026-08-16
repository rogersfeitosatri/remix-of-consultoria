import { describe, it, expect } from 'vitest';
import {
  bucketOf,
  dedupeOperations,
  groupOperations,
  overdueBusinessDays,
  slaDueDate,
  sortOperations,
  type Operation,
} from './dashboardOperations';

function op(partial: Partial<Operation> & Pick<Operation, 'id' | 'kind'>): Operation {
  return {
    clientId: null,
    clientName: 'Atleta',
    clientPhone: null,
    title: 'x',
    dueDate: null,
    createdAt: null,
    route: '/',
    sourceType: null,
    sourceId: null,
    ...partial,
  } as Operation;
}

describe('slaDueDate', () => {
  it('conta apenas dias úteis', () => {
    // 2026-01-08 é quinta → +3 dias úteis = terça 2026-01-13
    expect(slaDueDate('2026-01-08', 3)).toBe('2026-01-13');
  });

  it('pula feriado cadastrado', () => {
    expect(slaDueDate('2026-01-08', 3, new Set(['2026-01-12']))).toBe('2026-01-14');
  });
});

describe('bucketOf / groupOperations', () => {
  const today = new Date('2026-02-10T12:00:00');

  it('classifica atrasada, hoje e futura', () => {
    expect(bucketOf(op({ id: 'a', kind: 'manual_task', dueDate: '2026-02-09' }), today)).toBe('overdue');
    expect(bucketOf(op({ id: 'b', kind: 'manual_task', dueDate: '2026-02-10' }), today)).toBe('today');
    expect(bucketOf(op({ id: 'c', kind: 'manual_task', dueDate: '2026-02-11' }), today)).toBe('upcoming');
    expect(bucketOf(op({ id: 'd', kind: 'manual_task', dueDate: null }), today)).toBe('upcoming');
  });

  it('agrupa mantendo ordem por prazo', () => {
    const g = groupOperations(
      [
        op({ id: 'c', kind: 'manual_task', dueDate: '2026-02-11' }),
        op({ id: 'a', kind: 'checkin_review', dueDate: '2026-02-05' }),
        op({ id: 'b', kind: 'meal_plan', dueDate: '2026-02-08' }),
      ],
      today,
    );
    expect(g.overdue.map((o) => o.id)).toEqual(['a', 'b']);
    expect(g.upcoming.map((o) => o.id)).toEqual(['c']);
  });
});

describe('overdueBusinessDays', () => {
  it('ignora fim de semana', () => {
    // vencimento sexta 2026-02-06, hoje segunda 2026-02-09 → 1 dia útil
    const o = op({ id: 'a', kind: 'checkin_review', dueDate: '2026-02-06' });
    expect(overdueBusinessDays(o, new Set(), new Date('2026-02-09T12:00:00'))).toBe(1);
  });

  it('retorna 0 quando no prazo', () => {
    const o = op({ id: 'a', kind: 'checkin_review', dueDate: '2026-02-20' });
    expect(overdueBusinessDays(o, new Set(), new Date('2026-02-10T12:00:00'))).toBe(0);
  });
});

describe('dedupeOperations', () => {
  it('remove tarefa derivada que espelha pendência real', () => {
    const out = dedupeOperations([
      op({ id: 'checkin_review:1', kind: 'checkin_review', sourceType: 'checkin_response', sourceId: '1' }),
      op({ id: 'legacy_task:9', kind: 'legacy_task', sourceType: 'checkin_response', sourceId: '1' }),
      op({ id: 'manual_task:5', kind: 'manual_task' }),
    ]);
    expect(out.map((o) => o.id)).toEqual(['checkin_review:1', 'manual_task:5']);
  });

  it('mantém tarefa manual sem origem duplicada', () => {
    const out = dedupeOperations([
      op({ id: 'manual_task:1', kind: 'manual_task', sourceType: 'checkin_response', sourceId: '7' }),
    ]);
    expect(out).toHaveLength(1);
  });
});

describe('sortOperations', () => {
  it('coloca sem prazo por último', () => {
    const out = sortOperations([
      op({ id: 'sem', kind: 'manual_task', dueDate: null }),
      op({ id: 'com', kind: 'manual_task', dueDate: '2030-01-01' }),
    ]);
    expect(out.map((o) => o.id)).toEqual(['com', 'sem']);
  });
});
