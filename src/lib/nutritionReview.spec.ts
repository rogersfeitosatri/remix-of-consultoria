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

/* ETAPA 5A (revisada) — revisão estrutural do plano */
describe('revisão estrutural do plano (28 dias)', () => {
  it('mantém as três frequências de check-in independentes da revisão', () => {
    expect(CHECKIN_FREQUENCY_DAYS.weekly).toBe(7);
    expect(CHECKIN_FREQUENCY_DAYS.biweekly).toBe(14);
    expect(CHECKIN_FREQUENCY_DAYS.monthly).toBe(28);
    expect(STRUCTURAL_REVIEW_CYCLE_DAYS).toBe(28);
  });

  it('atleta sem consultas usa ciclo de 28 dias', () => {
    expect(usesStructuralReviewCycle({ has_consultations: false })).toBe(true);
  });

  it('consulta única/inicial NÃO desativa as revisões futuras', () => {
    expect(deriveConsultationMode({ has_consultations: true, consultation_count: 1 })).toBe('initial_only');
    expect(usesStructuralReviewCycle({ has_consultations: true, consultation_count: 1 })).toBe(true);
  });

  it('consulta recorrente não recebe revisão paralela de 28 dias', () => {
    expect(deriveConsultationMode({ has_consultations: true, consultation_count: 4 })).toBe('recurring');
    expect(usesStructuralReviewCycle({ has_consultations: true, consultation_count: 4 })).toBe(false);
    expect(usesStructuralReviewCycle({ has_consultations: true, consultation_frequency: 'monthly' })).toBe(false);
  });

  it('configuração explícita do atleta vence a derivação e o produto', () => {
    expect(
      resolveStructuralReviewMode(
        { structural_review_mode: 'every_28_days', has_consultations: true, consultation_count: 6 },
        { structural_review_mode: 'recurring_consultation' },
      ),
    ).toBe('every_28_days');
    expect(
      resolveStructuralReviewMode({ has_consultations: true, consultation_count: 1 }, { structural_review_mode: 'recurring_consultation' }),
    ).toBe('recurring_consultation');
  });

  it('a cadência é a data persistida, nunca a contagem de check-ins', () => {
    // semanal: 4 check-ins entre revisões, mas a regra é 28 dias
    expect(nextScheduledFor('2026-01-01', 28, '2026-01-10')).toBe('2026-01-29');
    // quinzenal e mensal chegam à mesma data
    expect(nextScheduledFor('2026-01-01', 28, '2026-01-29')).toBe('2026-01-29');
  });

  it('ausência de resposta não apaga nem adia a revisão', () => {
    const r = { status: 'pending' as const, scheduled_for: '2026-01-29' };
    expect(isDashboardObligation(r, '2026-02-10')).toBe(true);
    expect(reviewBucket(r, '2026-02-10')).toBe('pending');
  });

  it('estado do check-in vinculado é derivado do vínculo real', () => {
    expect(reviewCheckinState({ checkin_dispatch_id: null, checkin_response_id: null })).toBe('no_checkin');
    expect(reviewCheckinState({ checkin_dispatch_id: 'd', checkin_response_id: null })).toBe('awaiting_answer');
    expect(reviewCheckinState({ checkin_dispatch_id: 'd', checkin_response_id: 'r' })).toBe('answered');
  });

  it('congelamento não acumula revisões vencidas', () => {
    expect(isDashboardObligation({ status: 'paused', scheduled_for: '2026-01-01' }, '2026-03-01')).toBe(false);
  });
});
