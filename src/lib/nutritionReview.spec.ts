import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REVIEW_INTERVAL_DAYS,
  effectiveIntervalDays,
  isDashboardObligation,
  nextScheduledFor,
  reviewBucket,
} from './nutritionReview';

describe('effectiveIntervalDays', () => {
  it('usa o padrão central quando não há regra', () => {
    expect(effectiveIntervalDays(null, null)).toBe(DEFAULT_REVIEW_INTERVAL_DAYS);
  });
  it('produto sobrepõe o padrão', () => {
    expect(effectiveIntervalDays(null, 42)).toBe(42);
  });
  it('override individual sobrepõe o produto', () => {
    expect(effectiveIntervalDays(14, 42)).toBe(14);
  });
});

describe('nextScheduledFor', () => {
  it('soma o intervalo à referência', () => {
    expect(nextScheduledFor('2026-01-01', 28, '2026-01-05')).toBe('2026-01-29');
  });
  it('não cria backlog: no máximo uma revisão vencida', () => {
    expect(nextScheduledFor('2026-01-01', 28, '2026-06-01')).toBe('2026-05-21');
  });
  it('não depende de segunda-feira nem de check-in', () => {
    expect(nextScheduledFor('2026-01-07', 28, '2026-01-08')).toBe('2026-02-04');
  });
});

describe('reviewBucket', () => {
  const t = '2026-03-10';
  it('data chegou => pendente', () => {
    expect(reviewBucket({ status: 'scheduled', scheduled_for: '2026-03-10' }, t)).toBe('pending');
  });
  it('data futura => próxima', () => {
    expect(reviewBucket({ status: 'scheduled', scheduled_for: '2026-04-07' }, t)).toBe('upcoming');
  });
  it('concluída/cancelada => histórico', () => {
    expect(reviewBucket({ status: 'completed', scheduled_for: '2026-02-10' }, t)).toBe('history');
    expect(reviewBucket({ status: 'cancelled', scheduled_for: '2026-02-10' }, t)).toBe('history');
  });
});

describe('isDashboardObligation', () => {
  const t = '2026-03-10';
  it('pausada por congelamento não vira pendência', () => {
    expect(isDashboardObligation({ status: 'paused', scheduled_for: '2026-01-01' }, t)).toBe(false);
  });
  it('aguardando informação continua pendência', () => {
    expect(isDashboardObligation({ status: 'waiting_information', scheduled_for: '2026-04-01' }, t)).toBe(true);
  });
  it('futura ainda não é pendência', () => {
    expect(isDashboardObligation({ status: 'scheduled', scheduled_for: '2026-03-11' }, t)).toBe(false);
  });
  it('concluída nunca é pendência', () => {
    expect(isDashboardObligation({ status: 'completed', scheduled_for: '2026-01-01' }, t)).toBe(false);
  });
});
